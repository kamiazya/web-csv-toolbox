import type { DEFAULT_DELIMITER, DEFAULT_QUOTATION } from "@/core/constants.ts";
import type { ParseBinaryOptions } from "@/core/types.ts";
import { parseMime } from "@/helpers/mime/parseMime.ts";

/**
 * Extracts the options from the blob object.
 *
 * @param blob - The blob object from which to extract the options.
 * @param options - The options to merge with the extracted options.
 * @returns The options extracted from the blob.
 */
export function getOptionsFromBlob<
  Header extends ReadonlyArray<string>,
  Delimiter extends string = DEFAULT_DELIMITER,
  Quotation extends string = DEFAULT_QUOTATION,
>(
  blob: Blob,
  options: ParseBinaryOptions<
    Header,
    Delimiter,
    Quotation
  > = {} as ParseBinaryOptions<Header, Delimiter, Quotation>,
): ParseBinaryOptions<Header, Delimiter, Quotation> {
  // If blob has a type, try to extract charset information
  if (blob.type) {
    const mime = parseMime(blob.type);
    const charset = mime.parameters.charset;

    if (charset && !options.charset) {
      return {
        charset,
        ...options,
      };
    }
  }

  return options;
}
