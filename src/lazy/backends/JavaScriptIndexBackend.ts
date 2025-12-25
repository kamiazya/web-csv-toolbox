/**
 * JavaScript IndexBackend 実装
 *
 * シングルスレッドでCSVインデックスを生成する基本実装
 * 既存のLexerは使わず、バイトオフセットベースで直接インデックスを構築
 */

import type {
	ChunkRequest,
	ChunkResult,
	ChunkSummary,
	FinalizeRequest,
	FinalizeResult,
	IndexBackend,
	LocalChunkMeta,
} from "../types.js";

/**
 * JavaScriptIndexBackend のオプション
 */
export interface JavaScriptIndexBackendOptions {
	/** フィールドデリミタ（デフォルト: カンマ） */
	delimiter?: number; // byte value
	/** クオーテーション文字（デフォルト: ダブルクオート） */
	quotation?: number; // byte value
}

/**
 * JavaScriptIndexBackend
 *
 * シンプルなJavaScript実装のIndexBackend
 * UTF-8エンコーディングを前提とし、バイトオフセットベースでインデックスを生成
 */
export class JavaScriptIndexBackend implements IndexBackend {
	private readonly delimiter: number;
	private readonly quotation: number;
	private _disposed = false;

	constructor(options: JavaScriptIndexBackendOptions = {}) {
		this.delimiter = options.delimiter ?? 0x2c; // ','
		this.quotation = options.quotation ?? 0x22; // '"'
	}

	async submitChunk(req: ChunkRequest): Promise<ChunkResult> {
		if (this._disposed) {
			throw new Error("JavaScriptIndexBackend has been disposed");
		}

		const { sessionId, epoch, chunkId, bytes } = req;

		// Pass1: チャンク内の候補境界を抽出
		const { summary, candidatePositions } = this.scanChunk(bytes);

		// LocalChunkMeta として候補位置を保存
		const localMeta: LocalChunkMeta = {
			opaque: this.encodeCandidatePositions(candidatePositions),
		};

		return {
			sessionId,
			epoch,
			chunkId,
			summary,
			localMeta,
		};
	}

	async finalizeChunk(req: FinalizeRequest): Promise<FinalizeResult> {
		if (this._disposed) {
			throw new Error("JavaScriptIndexBackend has been disposed");
		}

		const { sessionId, epoch, chunkId, prefixState, localMeta, baseOffset } =
			req;

		// LocalChunkMeta から候補位置を復元
		const candidatePositions = this.decodeCandidatePositions(
			localMeta.opaque,
		);

		// prefixState を使って確定境界を決定
		// 簡略化のため、Pass1で見つけた候補をそのまま確定とする
		// （実際にはprefixStateを使ってクオートのパリティなどを考慮する）

		// Index構造を構築
		const { recordStart64, rowMeta, fieldBlob } =
			this.buildIndexStructure(candidatePositions, baseOffset);

		return {
			sessionId,
			epoch,
			chunkId,
			append: {
				recordStart64,
				rowMeta,
				fieldBlob,
			},
		};
	}

	/**
	 * チャンク内をスキャンして候補境界を抽出（Pass1）
	 */
	private scanChunk(bytes: Uint8Array): {
		summary: ChunkSummary;
		candidatePositions: CandidatePosition[];
	} {
		const candidatePositions: CandidatePosition[] = [];
		let inQuote = false;
		let quoteParity: 0 | 1 = 0;
		let currentRecord: number[] = []; // フィールド終了位置
		let fieldStart = 0;
		let approxSeparators = 0;

		for (let i = 0; i < bytes.length; i++) {
			const byte = bytes[i];

			if (byte === this.quotation) {
				// クオートのトグル
				if (!inQuote) {
					inQuote = true;
					quoteParity = 1 - quoteParity as 0 | 1;
				} else {
					// エスケープされたクオート "" かチェック
					if (i + 1 < bytes.length && bytes[i + 1] === this.quotation) {
						i++; // スキップ
					} else {
						inQuote = false;
					}
				}
			} else if (!inQuote) {
				if (byte === this.delimiter) {
					// フィールド区切り
					currentRecord.push(i);
					fieldStart = i + 1;
					approxSeparators++;
				} else if (byte === 0x0a) {
					// LF - レコード終了
					currentRecord.push(i);

					candidatePositions.push({
						recordEnd: i,
						fieldEnds: currentRecord,
					});

					currentRecord = [];
					fieldStart = i + 1;
				} else if (byte === 0x0d && i + 1 < bytes.length && bytes[i + 1] === 0x0a) {
					// CRLF - レコード終了
					currentRecord.push(i);

					candidatePositions.push({
						recordEnd: i + 1, // CRLF の場合は LF の位置
						fieldEnds: currentRecord,
					});

					currentRecord = [];
					i++; // LF をスキップ
					fieldStart = i + 1;
				}
			}
		}

		const endsInsideRecord = currentRecord.length > 0 || inQuote;

		return {
			summary: {
				quoteParity,
				endsInsideRecord,
				approxSeparators,
			},
			candidatePositions,
		};
	}

	/**
	 * 候補位置をArrayBufferにエンコード
	 */
	private encodeCandidatePositions(
		positions: CandidatePosition[],
	): ArrayBuffer {
		// 簡易的なエンコーディング
		// フォーマット: [recordCount, record1End, field1Count, ...fieldEnds, record2End, ...]
		const buffer: number[] = [positions.length];

		for (const pos of positions) {
			buffer.push(pos.recordEnd);
			buffer.push(pos.fieldEnds.length);
			buffer.push(...pos.fieldEnds);
		}

		return new Uint32Array(buffer).buffer;
	}

	/**
	 * ArrayBufferから候補位置をデコード
	 */
	private decodeCandidatePositions(buffer: ArrayBuffer): CandidatePosition[] {
		const data = new Uint32Array(buffer);
		const positions: CandidatePosition[] = [];
		let idx = 0;

		const recordCount = data[idx++];

		for (let i = 0; i < recordCount; i++) {
			const recordEnd = data[idx++];
			const fieldCount = data[idx++];
			const fieldEnds: number[] = [];

			for (let j = 0; j < fieldCount; j++) {
				fieldEnds.push(data[idx++]);
			}

			positions.push({ recordEnd, fieldEnds });
		}

		return positions;
	}

	/**
	 * 候補位置からIndex構造を構築
	 */
	private buildIndexStructure(
		positions: CandidatePosition[],
		baseOffset: bigint,
	): {
		recordStart64: BigUint64Array;
		rowMeta: Uint32Array;
		fieldBlob: Uint8Array;
	} {
		// recordStart64: 各レコードの開始オフセット
		const recordStart64 = new BigUint64Array(positions.length);

		// rowMeta: 各行のfieldBlob参照 [fieldBlobOffset, fieldCount]
		const rowMeta: number[] = [];

		// fieldBlob: フィールド境界情報（簡略化のため、そのままオフセットを格納）
		const fieldBlobData: number[] = [];

		let currentRecordStart = Number(baseOffset);
		let fieldBlobOffset = 0;

		for (let i = 0; i < positions.length; i++) {
			const pos = positions[i];

			// レコード開始位置を記録
			recordStart64[i] = BigInt(currentRecordStart);

			// フィールド数
			const fieldCount = pos.fieldEnds.length;

			// rowMeta: [fieldBlobOffset, fieldCount]
			rowMeta.push(fieldBlobOffset, fieldCount);

			// fieldBlob: 各フィールドの終了位置（簡略化）
			for (const fieldEnd of pos.fieldEnds) {
				// 実際にはvarintエンコーディングやデルタエンコーディングを使う
				// ここでは簡略化のためそのまま格納
				fieldBlobData.push(currentRecordStart + fieldEnd);
				fieldBlobOffset++;
			}

			// 次のレコードの開始位置
			currentRecordStart += pos.recordEnd + 1; // +1 for newline
		}

		return {
			recordStart64,
			rowMeta: new Uint32Array(rowMeta),
			fieldBlob: new Uint32Array(fieldBlobData).buffer as unknown as Uint8Array,
		};
	}

	async [Symbol.asyncDispose](): Promise<void> {
		this._disposed = true;
	}
}

/**
 * 候補位置（Pass1で検出された境界情報）
 */
interface CandidatePosition {
	/** レコード終了位置（チャンク先頭からの相対位置） */
	recordEnd: number;
	/** フィールド終了位置のリスト（チャンク先頭からの相対位置） */
	fieldEnds: number[];
}

/**
 * ファクトリ関数: JavaScriptIndexBackend を作成
 *
 * @example
 * ```typescript
 * await using backend = createJavaScriptIndexBackend({
 *   delimiter: 0x2c, // ','
 *   quotation: 0x22, // '"'
 * });
 *
 * const result = await backend.submitChunk({
 *   sessionId: 'session-1',
 *   epoch: 0,
 *   chunkId: 0,
 *   baseOffset: 0n,
 *   bytes: new Uint8Array([...])
 * });
 * ```
 */
export function createJavaScriptIndexBackend(
	options?: JavaScriptIndexBackendOptions,
): JavaScriptIndexBackend {
	return new JavaScriptIndexBackend(options);
}
