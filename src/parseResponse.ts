import { CSVRecord, ParseOptions } from "./common/index.js";
import { parseMime } from "./internal/parseMime.js";
import { toArray } from "./internal/toArray.js";
import { parseBinaryStream } from "./parseBinaryStream.js";

export function parseResponse<Header extends ReadonlyArray<string>>(
  response: Response,
  options?: ParseOptions<Header>,
): AsyncIterableIterator<CSVRecord<Header>> {
  const { headers } = response;
  const contentType = headers.get("content-type") ?? "text/csv";
  const mime = parseMime(contentType);
  if (mime.type !== "text/csv") {
    throw new Error(`Invalid mime type: ${contentType}`);
  }
  const decomposition =
    (headers.get("content-encoding") as CompressionFormat) ?? undefined;
  const charset = mime.parameters.charset ?? "utf-8";
  // TODO: Support header=present and header=absent
  // const header = mime.parameters.header ?? "present";
  if (response.body === null) {
    throw new Error("Response body is null");
  }
  return parseBinaryStream(response.body, {
    decomposition,
    charset,
    ...options,
  });
}

export namespace parseResponse {
  export declare function toArray<Header extends ReadonlyArray<string>>(
    response: Response,
    options?: ParseOptions<Header>,
  ): Promise<CSVRecord<Header>[]>;
}

parseResponse.toArray = toArray;
