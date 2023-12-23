import { CommonOptions } from "./common/index.js";
import { parseMime } from "./internal/parseMime.js";
import { toArray } from "./internal/toArray.js";
import { parseBinaryStream } from "./parseBinaryStream.js";
import { ParserOptions } from "./transformers/ParserTransformer.js";

export function parseResponse<Header extends ReadonlyArray<string>>(
  response: Response,
  options?: CommonOptions & ParserOptions<Header>,
): AsyncIterableIterator<Record<Header[number], string>> {
  const { headers } = response;
  const contentType = headers.get("content-type") ?? "text/csv";
  const mime = parseMime(contentType);
  if (mime.type !== "text/csv") {
    throw new Error(`Invalid mime type: ${contentType}`);
  }
  const decompression =
    (headers.get("content-encoding") as CompressionFormat) ?? undefined;
  const charset = mime.parameters.charset ?? "utf-8";
  // TODO: Support header=present and header=absent
  // const header = mime.parameters.header ?? "present";
  if (response.body === null) {
    throw new Error("Response body is null");
  }
  return parseBinaryStream(response.body, {
    decompression,
    charset: charset,
    ...options,
  });
}

export namespace parseResponse {
  export declare function toArray<Header extends ReadonlyArray<string>>(
    response: Response,
    options?: CommonOptions & ParserOptions<Header>,
  ): Promise<Record<Header[number], string>[]>;
}

parseResponse.toArray = toArray;
