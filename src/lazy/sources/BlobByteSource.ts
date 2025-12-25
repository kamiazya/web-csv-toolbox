/**
 * Blob/File ベースの AsyncByteSource 実装
 *
 * ブラウザの Blob/File API を使ってCSVデータを読み取る
 * ランダムアクセス（Range読み取り）とストリーミングの両方をサポート
 */

import type {
	AsyncByteSource,
	Length32,
	Offset64,
	SourceIdentity,
} from "../types.js";

export class BlobByteSource implements AsyncByteSource {
	private readonly blob: Blob;
	private _identity: SourceIdentity | null = null;

	constructor(
		blob: Blob,
		options?: {
			/** ソースの識別子（任意） */
			id?: string;
			/** ファイル名（Fileオブジェクトの場合は自動取得） */
			filename?: string;
		},
	) {
		this.blob = blob;

		// File オブジェクトの場合は name プロパティを使用
		const filename =
			options?.filename ??
			("name" in blob && typeof blob.name === "string" ? blob.name : undefined);

		// 初期identityを作成（lastModifiedは非同期で取得するため後で更新）
		this._identity = {
			id:
				options?.id ??
				(filename
					? `file:${filename}`
					: `blob:${blob.type || "application/octet-stream"}`),
			size: BigInt(blob.size),
			lastModifiedMs:
				"lastModified" in blob && typeof blob.lastModified === "number"
					? blob.lastModified
					: Date.now(),
		};
	}

	async identity(): Promise<SourceIdentity> {
		if (!this._identity) {
			throw new Error("BlobByteSource has been disposed");
		}
		return this._identity;
	}

	async read(offset: Offset64, length: Length32): Promise<Uint8Array> {
		const start = Number(offset);
		const end = Math.min(start + length, this.blob.size);

		if (start >= this.blob.size) {
			return new Uint8Array(0);
		}

		// Blob.slice() でRange読み取り
		const slice = this.blob.slice(start, end);
		const arrayBuffer = await slice.arrayBuffer();
		return new Uint8Array(arrayBuffer);
	}

	stream(): ReadableStream<Uint8Array> {
		// Blob.stream() を使ってストリーミング読み取り
		return this.blob.stream() as ReadableStream<Uint8Array>;
	}

	get capabilities() {
		return {
			randomAccess: true,
			streaming: true,
		};
	}

	async [Symbol.asyncDispose](): Promise<void> {
		// Blobはブラウザが管理するリソースなので特に破棄処理は不要
		this._identity = null;
	}
}

/**
 * ファクトリ関数: Blob から AsyncByteSource を作成
 *
 * @example
 * ```typescript
 * await using source = createBlobByteSource(blob);
 * const identity = await source.identity();
 * const chunk = await source.read(0n, 1024);
 * ```
 */
export function createBlobByteSource(
	blob: Blob,
	options?: {
		id?: string;
		filename?: string;
	},
): BlobByteSource {
	return new BlobByteSource(blob, options);
}

/**
 * ファクトリ関数: File から AsyncByteSource を作成
 * （BlobByteSourceのエイリアス、より明示的な名前）
 *
 * @example
 * ```typescript
 * const fileInput = document.querySelector<HTMLInputElement>('input[type="file"]');
 * const file = fileInput.files[0];
 * await using source = createFileByteSource(file);
 * ```
 */
export function createFileByteSource(
	file: File,
	options?: {
		id?: string;
	},
): BlobByteSource {
	return new BlobByteSource(file, {
		...options,
		filename: file.name,
	});
}
