/**
 * String ベースの SyncByteSource 実装
 *
 * メモリ上に既に存在する文字列データからCSVを読み取る
 * 同期的にアクセス可能なため、SyncByteSource を実装
 */

import type { Length32, SourceIdentity, SyncByteSource } from "../types.js";
import { noopDisposable } from "../utils/disposable.js";

export class StringByteSource implements SyncByteSource {
	private readonly bytes: Uint8Array;
	private readonly _identity: SourceIdentity;

	constructor(
		csv: string,
		options?: {
			/** ソースの識別子（任意） */
			id?: string;
			/** 文字エンコーディング（デフォルト: utf-8） */
			encoding?: string;
		},
	) {
		// 文字列をUTF-8バイト配列に変換
		const encoder = new TextEncoder();
		this.bytes = encoder.encode(csv);

		this._identity = {
			id: options?.id ?? `string:${this.generateHashId(csv)}`,
			size: BigInt(this.bytes.byteLength),
			lastModifiedMs: Date.now(),
		};
	}

	identity(): SourceIdentity {
		return this._identity;
	}

	readSync(offset: number, length: Length32): Uint8Array {
		const start = offset;
		const end = Math.min(offset + length, this.bytes.byteLength);

		if (start >= this.bytes.byteLength) {
			return new Uint8Array(0);
		}

		return this.bytes.slice(start, end);
	}

	/**
	 * 文字列から簡易的なハッシュIDを生成
	 * （完全な一意性は保証しないが、キャッシュキーとしては十分）
	 */
	private generateHashId(str: string): string {
		let hash = 0;
		// 最初の1000文字からハッシュを生成（大きなファイルでのパフォーマンスのため）
		const sample = str.slice(0, 1000);
		for (let i = 0; i < sample.length; i++) {
			const char = sample.charCodeAt(i);
			hash = (hash << 5) - hash + char;
			hash = hash & hash; // Convert to 32bit integer
		}
		return `${Math.abs(hash).toString(36)}-${str.length}`;
	}

	[Symbol.dispose](): void {
		// メモリ上のデータなので特に破棄処理は不要
		// ガベージコレクタに任せる
	}
}

/**
 * ファクトリ関数: 文字列から SyncByteSource を作成
 *
 * @example
 * ```typescript
 * using source = createStringByteSource('name,age\nAlice,30\nBob,25');
 * const identity = source.identity();
 * const chunk = source.readSync(0, 100);
 * ```
 */
export function createStringByteSource(
	csv: string,
	options?: {
		id?: string;
		encoding?: string;
	},
): StringByteSource {
	return new StringByteSource(csv, options);
}
