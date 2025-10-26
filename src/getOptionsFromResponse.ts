import type { ParseBinaryOptions } from "./common/types.ts";
import { parseMime } from "./utils/parseMime.ts";

/**
 * Supported compression formats for CSV decompression.
 * These correspond to the Web Standard CompressionFormat values.
 *
 * @see {@link https://developer.mozilla.org/en-US/docs/Web/API/CompressionFormat | CompressionFormat}
 */
const SUPPORTED_COMPRESSIONS: ReadonlySet<CompressionFormat> = new Set([
  "gzip",
  "deflate",
  "deflate-raw",
]);

/**
 * Extracts the options from the response object.
 *
 * @param response - The response object from which to extract the options.
 * @param options - The options to merge with the extracted options.
 * @returns The options extracted from the response.
 * @throws {RangeError} - The content type is not supported or the content-encoding is invalid.
 */
export function getOptionsFromResponse<Header extends ReadonlyArray<string>>(
  response: Response,
  options: ParseBinaryOptions<Header> = {},
): ParseBinaryOptions<Header> {
  const { headers } = response;
  const contentType = headers.get("content-type") ?? "text/csv";
  const mime = parseMime(contentType);
  if (mime.type !== "text/csv") {
    throw new RangeError(`Invalid mime type: "${contentType}"`);
  }

  const contentEncoding = headers.get("content-encoding");
  let decomposition: CompressionFormat | undefined;

  if (contentEncoding) {
    if (SUPPORTED_COMPRESSIONS.has(contentEncoding as CompressionFormat)) {
      decomposition = contentEncoding as CompressionFormat;
    } else {
      throw new RangeError(
        `Unsupported content-encoding: "${contentEncoding}". Supported formats: ${Array.from(SUPPORTED_COMPRESSIONS).join(", ")}`,
      );
    }
  }

  const charset = mime.parameters.charset ?? "utf-8";
  // TODO: Support header=present and header=absent
  // const header = mime.parameters.header ?? "present";
  return {
    decomposition,
    charset,
    ...options,
  };
}
