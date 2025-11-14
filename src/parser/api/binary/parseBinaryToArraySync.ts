import { convertBinaryToString } from "@/converters/binary/convertBinaryToString.ts";
import type { DEFAULT_DELIMITER } from "@/core/constants.ts";
import type { CSVRecord, ParseBinaryOptions } from "@/core/types.ts";
import { parseStringToArraySync } from "@/parser/api/string/parseStringToArraySync.ts";
import { commonParseErrorHandling } from "@/utils/error/commonParseErrorHandling.ts";

/**
 * Synchronously parses binary CSV data into an array of records.
 *
 * @param binary - The binary CSV data to parse (Uint8Array or ArrayBuffer).
 * @param options - Parsing options including charset, maxBinarySize, etc.
 * @returns An array of CSV records.
 * @throws {RangeError} If the binary size exceeds maxBinarySize limit.
 * @throws {ParseError} If the CSV data is malformed.
 *
 * @remarks
 * **WARNING**: This function loads the entire binary data into memory synchronously.
 * For large files (>100MB), consider using streaming alternatives like `parseStream()` or `parseUint8ArrayStream()`
 * to avoid memory exhaustion and blocking the event loop.
 *
 * The default maxBinarySize is 100MB. You can increase it via options, but this may lead to
 * memory issues with very large files.
 *
 * @example
 * ```ts
 * const binary = new TextEncoder().encode("name,age\nAlice,30");
 * const records = parseBinaryToArraySync(binary);
 * // [{ name: "Alice", age: "30" }]
 * ```
 */
export function parseBinaryToArraySync<
  Header extends ReadonlyArray<string>,
  Delimiter extends string = DEFAULT_DELIMITER,
  Quotation extends string = '"',
>(
  binary: Uint8Array | ArrayBuffer,
  options: ParseBinaryOptions<
    Header,
    Delimiter,
    Quotation
  > = {} as ParseBinaryOptions<Header, Delimiter, Quotation>,
): CSVRecord<Header>[] {
  try {
    const csv = convertBinaryToString(binary, options);
    return parseStringToArraySync(csv, options);
  } catch (error) {
    commonParseErrorHandling(error);
  }
}
