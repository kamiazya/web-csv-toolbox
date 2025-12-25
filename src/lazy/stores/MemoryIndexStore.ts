/**
 * メモリ内 IndexStore 実装
 *
 * インデックスをメモリ（Map）内に保存する最も基本的な実装
 * 永続化はされないが、同一プロセス内でのインデックス再利用が可能
 */

import type { IndexArtifact, IndexStore } from "../types.js";

export class MemoryIndexStore implements IndexStore {
	private readonly store = new Map<string, IndexArtifact>();
	private _disposed = false;

	async load(key: string): Promise<IndexArtifact | null> {
		if (this._disposed) {
			throw new Error("MemoryIndexStore has been disposed");
		}

		return this.store.get(key) ?? null;
	}

	async save(key: string, artifact: IndexArtifact): Promise<void> {
		if (this._disposed) {
			throw new Error("MemoryIndexStore has been disposed");
		}

		// Deep copy して保存（元データの変更による影響を防ぐ）
		const cloned: IndexArtifact = {
			formatVersion: artifact.formatVersion,
			createdAtMs: artifact.createdAtMs,
			sourceIdentity: { ...artifact.sourceIdentity },
			limits: { ...artifact.limits },
			core: {
				// TypedArray のコピー
				recordStart64: new BigUint64Array(artifact.core.recordStart64),
				rowMeta: new Uint32Array(artifact.core.rowMeta),
				fieldBlob: new Uint8Array(artifact.core.fieldBlob),
				recordLen32: artifact.core.recordLen32
					? new Uint32Array(artifact.core.recordLen32)
					: undefined,
			},
			meta: artifact.meta ? { ...artifact.meta } : undefined,
		};

		this.store.set(key, cloned);
	}

	async delete(key: string): Promise<void> {
		if (this._disposed) {
			throw new Error("MemoryIndexStore has been disposed");
		}

		this.store.delete(key);
	}

	/**
	 * 全てのインデックスをクリア
	 */
	async clear(): Promise<void> {
		if (this._disposed) {
			throw new Error("MemoryIndexStore has been disposed");
		}

		this.store.clear();
	}

	/**
	 * 保存されているインデックスの数を取得
	 */
	get size(): number {
		return this.store.size;
	}

	/**
	 * 保存されている全てのキーを取得
	 */
	keys(): string[] {
		return Array.from(this.store.keys());
	}

	async [Symbol.asyncDispose](): Promise<void> {
		this.store.clear();
		this._disposed = true;
	}
}

/**
 * ファクトリ関数: MemoryIndexStore を作成
 *
 * @example
 * ```typescript
 * await using store = createMemoryIndexStore();
 *
 * // インデックスの保存
 * await store.save('key1', indexArtifact);
 *
 * // インデックスの読み込み
 * const loaded = await store.load('key1');
 *
 * // 自動的に破棄される（using構文）
 * ```
 */
export function createMemoryIndexStore(): MemoryIndexStore {
	return new MemoryIndexStore();
}
