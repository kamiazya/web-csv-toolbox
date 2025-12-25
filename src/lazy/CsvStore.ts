/**
 * CsvStore 実装
 *
 * ステートフルなCSVストア
 * インデックスを使ったランダムアクセスと効率的な行イテレーションを提供
 */

import type {
	AsyncByteSource,
	ChunkRequest,
	CsvStore,
	CsvStoreFactory as ICsvStoreFactory,
	CsvStoreOptions,
	FieldFlags,
	FieldRef,
	IndexArtifact,
	IndexBackend,
	IndexCore,
	IndexStore,
	Length32,
	Limits,
	Offset64,
	SourceIdentity,
} from "./types.js";
import { combineAsyncDisposable } from "./utils/disposable.js";

/**
 * CsvStoreImpl
 *
 * CsvStore の基本実装
 */
export class CsvStoreImpl implements CsvStore {
	private readonly source: AsyncByteSource;
	private readonly backend: IndexBackend;
	private readonly indexStore: IndexStore | undefined;
	private readonly limits: Limits;
	private readonly indexKey: (identity: SourceIdentity) => string;

	private _identity: SourceIdentity | null = null;
	private _index: IndexCore | null = null;
	private _disposed = false;

	// チャンクサイズ（デフォルト: 1MB）
	private readonly chunkSize = 1024 * 1024;

	constructor(options: CsvStoreOptions) {
		this.source = options.source;
		this.backend = options.backend;
		this.indexStore = options.indexStore;
		this.limits = options.limits;
		this.indexKey =
			options.indexKey ?? ((identity) => `csv-index:${identity.id}`);
	}

	get identity(): SourceIdentity {
		if (!this._identity) {
			throw new Error(
				"CsvStore not initialized. Call buildIndex() first or the store has been disposed.",
			);
		}
		return this._identity;
	}

	/**
	 * インデックスを構築
	 */
	async buildIndex(options?: { signal?: AbortSignal }): Promise<void> {
		if (this._disposed) {
			throw new Error("CsvStore has been disposed");
		}

		const signal = options?.signal;

		// ソースの identity を取得
		this._identity = await this.source.identity();

		// 既存のインデックスをロード
		if (this.indexStore) {
			const key = this.indexKey(this._identity);
			const existing = await this.indexStore.load(key);

			if (existing && this.validateIndexArtifact(existing)) {
				// 既存のインデックスを使用
				this._index = existing.core;
				return;
			}
		}

		// 新しいインデックスを生成
		await this.generateIndex(signal);

		// インデックスを保存
		if (this.indexStore && this._index && this._identity) {
			const artifact: IndexArtifact = {
				formatVersion: 1,
				createdAtMs: Date.now(),
				sourceIdentity: this._identity,
				limits: this.limits,
				core: this._index,
			};

			const key = this.indexKey(this._identity);
			await this.indexStore.save(key, artifact);
		}
	}

	/**
	 * インデックスを生成（チャンク単位）
	 */
	private async generateIndex(signal?: AbortSignal): Promise<void> {
		// セキュアな乱数生成器を使用（環境に応じて自動選択）
		const { generateSessionId } = await import(
			"#/lazy/utils/generateSessionId.js"
		);
		const sessionId = await generateSessionId();
		const epoch = 0;

		const sourceSize = this._identity?.size
			? Number(this._identity.size)
			: await this.getSourceSize();

		// チャンク分割
		const chunks: ChunkRequest[] = [];
		let chunkId = 0;

		for (let offset = 0; offset < sourceSize; offset += this.chunkSize) {
			const length = Math.min(this.chunkSize, sourceSize - offset);
			const bytes = await this.source.read(BigInt(offset), length);

			chunks.push({
				sessionId,
				epoch,
				chunkId: chunkId++,
				baseOffset: BigInt(offset),
				bytes,
			});

			// AbortSignal チェック
			if (signal?.aborted) {
				throw new DOMException("Index building aborted", "AbortError");
			}
		}

		// Pass1: 各チャンクを処理
		const chunkResults = await Promise.all(
			chunks.map((chunk) => this.backend.submitChunk(chunk)),
		);

		// チャンク結果の検証（session/epoch/chunkId の整合性チェック）
		// メインスレッドが single source of truth: 古いセッション/キャンセル後の結果は破棄
		for (const result of chunkResults) {
			if (result.sessionId !== sessionId || result.epoch !== epoch) {
				throw new Error(
					`Invalid chunk result: session/epoch mismatch (expected: ${sessionId}/${epoch}, got: ${result.sessionId}/${result.epoch})`,
				);
			}
		}

		// Pass2: 確定境界を作成（簡略化のため、finalizeChunkを呼ばずに直接結合）
		// 実際には prefixState を計算して finalizeChunk を呼ぶ
		const recordStart64List: bigint[] = [];
		const rowMetaList: number[] = [];
		const fieldBlobList: number[] = [];

		for (let i = 0; i < chunkResults.length; i++) {
			const result = chunkResults[i];

			if (!this.backend.finalizeChunk) {
				// finalizeChunk が実装されていない場合はスキップ
				continue;
			}

			const finalizeRequest = {
				sessionId,
				epoch,
				chunkId: result.chunkId,
				prefixState: new ArrayBuffer(0), // 簡略化
				localMeta: result.localMeta,
				baseOffset: chunks[i].baseOffset,
				bytes: chunks[i].bytes,
			};

			const finalizeResult = await this.backend.finalizeChunk(finalizeRequest);

			// 結果の検証（session/epoch/chunkId の整合性チェック）
			if (
				finalizeResult.sessionId !== sessionId ||
				finalizeResult.epoch !== epoch ||
				finalizeResult.chunkId !== result.chunkId
			) {
				// 不正な結果は破棄（Worker/キャンセル後の古い結果など）
				console.warn(
					`Discarding invalid finalize result: session/epoch/chunkId mismatch`,
				);
				continue;
			}

			// append-only でインデックスを構築（chunkId 順にcommitすることで整合を保つ）
			if (finalizeResult.append.recordStart64) {
				for (const offset of finalizeResult.append.recordStart64) {
					recordStart64List.push(offset);
				}
			}

			if (finalizeResult.append.rowMeta) {
				for (const meta of finalizeResult.append.rowMeta) {
					rowMetaList.push(meta);
				}
			}

			if (finalizeResult.append.fieldBlob) {
				for (const blob of finalizeResult.append.fieldBlob) {
					fieldBlobList.push(blob);
				}
			}

			// AbortSignal チェック
			if (signal?.aborted) {
				throw new DOMException("Index building aborted", "AbortError");
			}
		}

		// IndexCore を構築
		this._index = {
			recordStart64: new BigUint64Array(recordStart64List),
			rowMeta: new Uint32Array(rowMetaList),
			fieldBlob: new Uint8Array(new Uint32Array(fieldBlobList).buffer),
		};
	}

	/**
	 * ソースサイズを取得（ストリーミングの場合）
	 */
	private async getSourceSize(): Promise<number> {
		// ストリーミング読み取りでサイズを計算
		// 実際には source.capabilities.randomAccess をチェックして
		// ランダムアクセス可能な場合は効率的な方法を使う
		let size = 0;
		const stream = this.source.stream?.();

		if (!stream) {
			throw new Error(
				"Cannot determine source size: source does not support streaming",
			);
		}

		const reader = stream.getReader();
		try {
			while (true) {
				const { done, value } = await reader.read();
				if (done) break;
				size += value.byteLength;
			}
		} finally {
			reader.releaseLock();
		}

		return size;
	}

	/**
	 * IndexArtifact の検証
	 */
	private validateIndexArtifact(artifact: IndexArtifact): boolean {
		if (!this._identity) return false;

		// バージョンチェック
		if (artifact.formatVersion !== 1) return false;

		// source identity のチェック
		if (artifact.sourceIdentity.id !== this._identity.id) return false;

		// サイズチェック
		if (
			artifact.sourceIdentity.size &&
			this._identity.size &&
			artifact.sourceIdentity.size !== this._identity.size
		) {
			return false;
		}

		// ETag チェック
		if (
			artifact.sourceIdentity.etag &&
			this._identity.etag &&
			artifact.sourceIdentity.etag !== this._identity.etag
		) {
			return false;
		}

		return true;
	}

	async getFieldRef(row: number, col: number): Promise<FieldRef> {
		if (this._disposed) {
			throw new Error("CsvStore has been disposed");
		}

		if (!this._index) {
			throw new Error("Index not built. Call buildIndex() first.");
		}

		// rowMeta から該当行のフィールド情報を取得
		const rowMetaOffset = row * 2; // [fieldBlobOffset, fieldCount]
		if (rowMetaOffset + 1 >= this._index.rowMeta.length) {
			throw new RangeError(`Row ${row} out of bounds`);
		}

		const fieldBlobOffset = this._index.rowMeta[rowMetaOffset];
		const fieldCount = this._index.rowMeta[rowMetaOffset + 1];

		if (col >= fieldCount) {
			throw new RangeError(
				`Column ${col} out of bounds (row has ${fieldCount} fields)`,
			);
		}

		// fieldBlob から該当フィールドの位置を取得
		// 簡略化のため、Uint32Array として読み取る
		const fieldBlobData = new Uint32Array(this._index.fieldBlob.buffer);
		const fieldEndOffset = fieldBlobData[fieldBlobOffset + col];

		// フィールドの開始位置を計算
		const fieldStartOffset =
			col === 0
				? Number(this._index.recordStart64[row])
				: fieldBlobData[fieldBlobOffset + col - 1] + 1; // +1 for delimiter

		return {
			offset: BigInt(fieldStartOffset),
			length: fieldEndOffset - fieldStartOffset,
			flags: {
				isQuoted: false, // 簡略化のため常にfalse
				hasEscapedQuote: false,
			},
		};
	}

	async getCell(
		row: number,
		col: number,
		opts?: { encoding?: "utf-8"; maxChars?: number },
	): Promise<string> {
		const fieldRef = await this.getFieldRef(row, col);

		// フィールドのバイトデータを読み取る
		const bytes = await this.source.read(fieldRef.offset, fieldRef.length);

		// デコード
		const decoder = new TextDecoder(opts?.encoding ?? "utf-8");
		let text = decoder.decode(bytes);

		// クオート処理（簡略化）
		if (fieldRef.flags.isQuoted) {
			// 外側のクオートを除去
			text = text.slice(1, -1);
		}

		if (fieldRef.flags.hasEscapedQuote) {
			// エスケープされたクオートを戻す
			text = text.replace(/""/g, '"');
		}

		// 最大文字数制限
		if (opts?.maxChars && text.length > opts.maxChars) {
			text = text.slice(0, opts.maxChars);
		}

		return text;
	}

	async *rows(range?: { from?: number; to?: number }): AsyncIterable<{
		row: number;
		get: (col: number) => Promise<string>;
	}> {
		if (this._disposed) {
			throw new Error("CsvStore has been disposed");
		}

		if (!this._index) {
			throw new Error("Index not built. Call buildIndex() first.");
		}

		const from = range?.from ?? 0;
		const to = range?.to ?? this._index.recordStart64.length;

		for (let row = from; row < to; row++) {
			yield {
				row,
				get: (col: number) => this.getCell(row, col),
			};
		}
	}

	async [Symbol.asyncDispose](): Promise<void> {
		if (this._disposed) return;

		// すべてのリソースを破棄
		const combined = combineAsyncDisposable(
			this.source,
			this.backend,
			this.indexStore,
		);

		await combined[Symbol.asyncDispose]();

		this._identity = null;
		this._index = null;
		this._disposed = true;
	}
}

/**
 * CsvStoreFactory 実装
 */
export const CsvStoreFactory: ICsvStoreFactory = {
	async open(opts: CsvStoreOptions): Promise<CsvStore> {
		return new CsvStoreImpl(opts);
	},
};

/**
 * ファクトリ関数: CsvStore を作成（簡易版）
 *
 * @example
 * ```typescript
 * import { createCsvStore } from 'web-csv-toolbox/lazy';
 * import { createBlobByteSource } from 'web-csv-toolbox/lazy/sources';
 * import { createJavaScriptIndexBackend } from 'web-csv-toolbox/lazy/backends';
 * import { createMemoryIndexStore } from 'web-csv-toolbox/lazy/stores';
 *
 * await using store = await createCsvStore({
 *   source: createBlobByteSource(blob),
 *   backend: createJavaScriptIndexBackend(),
 *   indexStore: createMemoryIndexStore(),
 *   limits: {
 *     maxFieldBytes: 1024 * 1024,
 *     maxRecordBytes: 10 * 1024 * 1024,
 *     maxFieldsPerRecord: 1000,
 *   }
 * });
 *
 * await store.buildIndex();
 * const cell = await store.getCell(0, 0);
 * ```
 */
export async function createCsvStore(
	opts: CsvStoreOptions,
): Promise<CsvStore> {
	return CsvStoreFactory.open(opts);
}
