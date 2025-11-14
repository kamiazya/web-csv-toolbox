import type { DEFAULT_DELIMITER } from "@/core/constants.ts";
import type { ParseBinaryOptions } from "@/core/types.ts";
import { getOptionsFromBlob } from "@/utils/blob/getOptionsFromBlob.ts";

/**
 * Extracts the options from the file object.
 *
 * @remarks
 * This function automatically sets the file name as the error source
 * for better error reporting (unless explicitly overridden via options).
 *
 * @param file - The file object from which to extract the options.
 * @param options - The options to merge with the extracted options.
 * @returns The options extracted from the file.
 */
export function getOptionsFromFile<
  Header extends ReadonlyArray<string>,
  Delimiter extends string = DEFAULT_DELIMITER,
>(
  file: File,
  options: ParseBinaryOptions<Header, Delimiter> = {} as ParseBinaryOptions<
    Header,
    Delimiter
  >,
): ParseBinaryOptions<Header, Delimiter> {
  // Get options from blob (charset extraction)
  const blobOptions = getOptionsFromBlob(file, options);

  // Add file name as source for error reporting if not already set
  return {
    ...blobOptions,
    source: options.source ?? file.name,
  };
}
