import { SUPPORTED_COMPRESSIONS } from "#getOptionsFromResponse.constants.js";
import type { ParseBinaryOptions } from "./common/types.ts";
import { parseMime } from "./utils/parseMime.ts";

/**
 * Extracts the options from the response object.
 *
 * @param response - The response object from which to extract the options.
 * @param options - The options to merge with the extracted options.
 * @returns The options extracted from the response.
 * @throws {TypeError} - The content type is not supported or the content-encoding is invalid.
 */
export function getOptionsFromResponse<Header extends ReadonlyArray<string>>(
  response: Response,
  options: ParseBinaryOptions<Header> = {},
): ParseBinaryOptions<Header> {
  const { headers } = response;
  const contentType = headers.get("content-type") ?? "text/csv";
  const mime = parseMime(contentType);
  if (mime.type !== "text/csv") {
    throw new TypeError(`Invalid mime type: "${contentType}"`);
  }

  const contentEncoding = headers.get("content-encoding");
  let decomposition: CompressionFormat | undefined;

  if (contentEncoding) {
    const normalizedEncoding = contentEncoding.trim().toLowerCase();

    if (normalizedEncoding.includes(",")) {
      throw new TypeError(
        `Multiple content-encodings are not supported: "${contentEncoding}"`,
      );
    }

    if (SUPPORTED_COMPRESSIONS.has(normalizedEncoding as CompressionFormat)) {
      decomposition = normalizedEncoding as CompressionFormat;
    } else if (normalizedEncoding) {
      // Unknown compression format
      if (options.allowExperimentalCompressions) {
        // Allow runtime to handle experimental/future formats
        decomposition = normalizedEncoding as CompressionFormat;
      } else {
        throw new TypeError(
          `Unsupported content-encoding: "${contentEncoding}". Supported formats: ${Array.from(SUPPORTED_COMPRESSIONS).join(", ")}. To use experimental formats, set allowExperimentalCompressions: true`,
        );
      }
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
