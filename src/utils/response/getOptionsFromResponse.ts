import { SUPPORTED_CHARSETS } from "#getCharsetValidation.constants.js";
import { SUPPORTED_COMPRESSIONS } from "#getOptionsFromResponse.constants.js";
import type { DEFAULT_DELIMITER } from "../../core/constants.ts";
import type { ParseBinaryOptions } from "../../core/types.ts";
import { parseMime } from "../../helpers/mime/parseMime.ts";

/**
 * Extracts the options from the response object.
 *
 * @param response - The response object from which to extract the options.
 * @param options - The options to merge with the extracted options.
 * @returns The options extracted from the response.
 * @throws {TypeError} - The content type is not supported or the content-encoding is invalid.
 */
export function getOptionsFromResponse<
  Header extends ReadonlyArray<string>,
  Delimiter extends string = DEFAULT_DELIMITER,
  Quotation extends string = '"',
>(
  response: Response,
  options: ParseBinaryOptions<
    Header,
    Delimiter,
    Quotation
  > = {} as ParseBinaryOptions<Header, Delimiter, Quotation>,
): ParseBinaryOptions<Header, Delimiter, Quotation> {
  const { headers } = response;
  const contentType = headers.get("content-type") ?? "text/csv";
  const mime = parseMime(contentType);
  if (mime.type !== "text/csv") {
    throw new TypeError(`Invalid mime type: "${contentType}"`);
  }

  const contentEncoding = headers.get("content-encoding");
  let decompression: CompressionFormat | undefined;

  if (contentEncoding) {
    const normalizedEncoding = contentEncoding.trim().toLowerCase();

    if (normalizedEncoding.includes(",")) {
      throw new TypeError(
        `Multiple content-encodings are not supported: "${contentEncoding}"`,
      );
    }

    if (SUPPORTED_COMPRESSIONS.has(normalizedEncoding as CompressionFormat)) {
      decompression = normalizedEncoding as CompressionFormat;
    } else if (normalizedEncoding) {
      // Unknown compression format
      if (options.allowExperimentalCompressions) {
        // Allow runtime to handle experimental/future formats
        decompression = normalizedEncoding as CompressionFormat;
      } else {
        throw new TypeError(
          `Unsupported content-encoding: "${contentEncoding}". Supported formats: ${Array.from(SUPPORTED_COMPRESSIONS).join(", ")}. To use experimental formats, set allowExperimentalCompressions: true`,
        );
      }
    }
  }

  // Validate and normalize charset
  const rawCharset = mime.parameters.charset ?? "utf-8";
  const normalizedCharset = rawCharset.trim().toLowerCase();

  let charset: string;
  if (SUPPORTED_CHARSETS.has(normalizedCharset)) {
    charset = normalizedCharset;
  } else if (normalizedCharset) {
    // Unknown charset
    if (options.allowNonStandardCharsets) {
      // Allow runtime to handle non-standard charsets
      charset = normalizedCharset;
    } else {
      throw new TypeError(
        `Unsupported charset: "${rawCharset}". Commonly supported charsets include: utf-8, utf-16le, iso-8859-1, windows-1252, shift_jis, gb18030, euc-kr, etc. To use non-standard charsets, set allowNonStandardCharsets: true`,
      );
    }
  } else {
    charset = "utf-8";
  }

  // TODO: Support header=present and header=absent
  // const header = mime.parameters.header ?? "present";
  return {
    decompression,
    charset,
    ...options,
  };
}
