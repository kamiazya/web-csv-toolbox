/**
 * Response ベースの AsyncByteSource 実装
 *
 * HTTP レスポンスから CSV データを読み取る
 * Range Request をサポートするサーバーではランダムアクセスが可能
 * サポートしない場合はストリーミング読み取りのみ
 */

import type {
	AsyncByteSource,
	Length32,
	Offset64,
	SourceIdentity,
} from "../types.js";

export class ResponseByteSource implements AsyncByteSource {
	private readonly response: Response;
	private readonly url: string;
	private _identity: SourceIdentity | null = null;
	private _capabilities: {
		randomAccess: boolean;
		streaming: boolean;
	} | null = null;
	private _contentLength: number | null = null;

	constructor(
		response: Response,
		options?: {
			/** ソースの識別子（任意、デフォルトはURL） */
			id?: string;
			/** オリジナルのURL（responseが既にクローンされている場合） */
			url?: string;
		},
	) {
		this.response = response;
		this.url = options?.url ?? response.url;

		// Range Request のサポートを確認
		const acceptRanges = response.headers.get("Accept-Ranges");
		const supportsRangeRequest = acceptRanges === "bytes";

		// Content-Length を取得
		const contentLength = response.headers.get("Content-Length");
		this._contentLength = contentLength ? Number.parseInt(contentLength, 10) : null;

		this._capabilities = {
			randomAccess: supportsRangeRequest,
			streaming: !!response.body,
		};

		// ETag の取得
		const etag = response.headers.get("ETag");
		const lastModified = response.headers.get("Last-Modified");

		this._identity = {
			id: options?.id ?? `http:${this.url}`,
			size: this._contentLength !== null ? BigInt(this._contentLength) : undefined,
			etag: etag ?? undefined,
			lastModifiedMs: lastModified
				? new Date(lastModified).getTime()
				: undefined,
		};
	}

	async identity(): Promise<SourceIdentity> {
		if (!this._identity) {
			throw new Error("ResponseByteSource has been disposed");
		}
		return this._identity;
	}

	async read(offset: Offset64, length: Length32): Promise<Uint8Array> {
		if (!this._capabilities?.randomAccess) {
			throw new Error(
				"Random access not supported. Server does not support Range requests (Accept-Ranges: bytes)",
			);
		}

		const start = Number(offset);
		const end = start + length - 1;

		// Range Request を発行
		const rangeResponse = await fetch(this.url, {
			headers: {
				Range: `bytes=${start}-${end}`,
			},
		});

		if (!rangeResponse.ok) {
			throw new Error(
				`Failed to fetch range: ${rangeResponse.status} ${rangeResponse.statusText}`,
			);
		}

		// レスポンスがPartial Content (206) でない場合は警告
		if (rangeResponse.status !== 206) {
			console.warn(
				`Expected 206 Partial Content but got ${rangeResponse.status}. Server may not support Range requests properly.`,
			);
		}

		const arrayBuffer = await rangeResponse.arrayBuffer();
		return new Uint8Array(arrayBuffer);
	}

	stream(): ReadableStream<Uint8Array> {
		if (!this.response.body) {
			throw new Error("Response body is not available for streaming");
		}

		return this.response.body as ReadableStream<Uint8Array>;
	}

	get capabilities() {
		if (!this._capabilities) {
			throw new Error("ResponseByteSource has been disposed");
		}
		return this._capabilities;
	}

	async [Symbol.asyncDispose](): Promise<void> {
		// Response の body を消費して破棄
		if (this.response.body && !this.response.bodyUsed) {
			try {
				await this.response.body.cancel();
			} catch {
				// body が既に消費されている場合などのエラーは無視
			}
		}
		this._identity = null;
		this._capabilities = null;
	}
}

/**
 * ファクトリ関数: Response から AsyncByteSource を作成
 *
 * @example
 * ```typescript
 * const response = await fetch('https://example.com/data.csv');
 * await using source = createResponseByteSource(response);
 * const identity = await source.identity();
 *
 * // Range Request がサポートされている場合
 * if (source.capabilities.randomAccess) {
 *   const chunk = await source.read(0n, 1024);
 * } else {
 *   // ストリーミングのみ
 *   const stream = source.stream();
 * }
 * ```
 */
export function createResponseByteSource(
	response: Response,
	options?: {
		id?: string;
		url?: string;
	},
): ResponseByteSource {
	return new ResponseByteSource(response, options);
}

/**
 * ファクトリ関数: URL から AsyncByteSource を作成
 * 内部で fetch() を実行して ResponseByteSource を作成
 *
 * @example
 * ```typescript
 * await using source = await createURLByteSource('https://example.com/data.csv');
 * const chunk = await source.read(0n, 1024);
 * ```
 */
export async function createURLByteSource(
	url: string | URL,
	options?: {
		id?: string;
		fetchOptions?: RequestInit;
	},
): Promise<ResponseByteSource> {
	const response = await fetch(url, options?.fetchOptions);

	if (!response.ok) {
		throw new Error(
			`Failed to fetch URL: ${response.status} ${response.statusText}`,
		);
	}

	return new ResponseByteSource(response, {
		id: options?.id,
		url: url.toString(),
	});
}
