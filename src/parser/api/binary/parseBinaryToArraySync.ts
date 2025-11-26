import { convertBinaryToString } from "@/converters/binary/convertBinaryToString.ts";
import { convertBinaryToUint8Array } from "@/converters/binary/convertBinaryToUint8Array.ts";
import { DEFAULT_BINARY_MAX_SIZE } from "@/core/constants.ts";
import type { InferCSVRecord, ParseBinaryOptions } from "@/core/types.ts";
import { InternalEngineConfig } from "@/engine/config/InternalEngineConfig.ts";
import { parseStringToArraySync } from "@/parser/api/string/parseStringToArraySync.ts";
import { WASMBinaryCSVArrayParser } from "@/parser/models/WASMBinaryCSVArrayParser.ts";
import { WASMBinaryObjectCSVParser } from "@/parser/models/WASMBinaryObjectCSVParser.ts";
import { validateWASMCharset } from "@/parser/utils/wasmValidation.ts";
import { commonParseErrorHandling } from "@/utils/error/commonParseErrorHandling.ts";

/**
 * Synchronously parses binary CSV data into an array of records.
 *
 * @param binary - The binary CSV data to parse (BufferSource: Uint8Array, ArrayBuffer, or other TypedArray).
 * @param options - Parsing options including charset, maxBinarySize, etc.
 * @returns An array of CSV records.
 * @throws {RangeError} If the binary size exceeds maxBinarySize limit.
 * @throws {ParseError} If the CSV data is malformed.
 *
 * @remarks
 * **WARNING**: This function loads the entire binary data into memory synchronously.
 * For large files (>100MB), consider using streaming alternatives like `parseStream()` or `parseBinaryStream()`
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
  Options extends ParseBinaryOptions<Header> = ParseBinaryOptions<Header>,
>(binary: BufferSource, options?: Options): InferCSVRecord<Header, Options>[] {
  try {
    // Parse engine configuration
    const engineConfig = new InternalEngineConfig(options?.engine);

    if (engineConfig.hasWasm()) {
      // WASM execution (direct binary processing, UTF-8 only)

      // Validate charset - WASM parser only supports UTF-8
      validateWASMCharset(options?.charset);

      // Validate maxBinarySize
      const maxBinarySize = options?.maxBinarySize ?? DEFAULT_BINARY_MAX_SIZE;
      if (
        !(
          Number.isFinite(maxBinarySize) ||
          maxBinarySize === Number.POSITIVE_INFINITY
        ) ||
        (Number.isFinite(maxBinarySize) && maxBinarySize < 0)
      ) {
        throw new RangeError(
          "maxBinarySize must be a non-negative number or Number.POSITIVE_INFINITY",
        );
      }

      // Check binary size to prevent DoS
      if (Number.isFinite(maxBinarySize) && binary.byteLength > maxBinarySize) {
        throw new RangeError(
          `Binary size (${binary.byteLength} bytes) exceeded maximum allowed size of ${maxBinarySize} bytes`,
        );
      }

      // Convert BufferSource to Uint8Array
      let bytes = convertBinaryToUint8Array(binary);

      // Handle BOM if ignoreBOM is false (default behavior)
      // UTF-8 BOM is EF BB BF (3 bytes)
      const ignoreBOM = options?.ignoreBOM ?? false;
      if (
        !ignoreBOM &&
        bytes.length >= 3 &&
        bytes[0] === 0xef &&
        bytes[1] === 0xbb &&
        bytes[2] === 0xbf
      ) {
        // Skip UTF-8 BOM
        bytes = bytes.subarray(3);
      }

      // Handle fatal option - validate UTF-8 if fatal is true
      const fatal = options?.fatal ?? false;
      if (fatal) {
        // Validate UTF-8 encoding by attempting to decode
        const decoder = new TextDecoder("utf-8", { fatal: true });
        try {
          decoder.decode(bytes);
        } catch {
          throw new TypeError(
            "The encoded data was not valid UTF-8. Set fatal: false to use replacement characters for invalid sequences.",
          );
        }
      }

      const outputFormat = options?.outputFormat ?? "object";

      if (outputFormat === "array") {
        const parser = new WASMBinaryCSVArrayParser<Header>({
          delimiter: options?.delimiter ?? ",",
          quotation: options?.quotation ?? '"',
          maxFieldCount: options?.maxFieldCount,
          header: options?.header,
        });
        return [...parser.parse(bytes as BufferSource)] as InferCSVRecord<
          Header,
          Options
        >[];
      }
      const parser = new WASMBinaryObjectCSVParser<Header>({
        delimiter: options?.delimiter ?? ",",
        quotation: options?.quotation ?? '"',
        maxFieldCount: options?.maxFieldCount,
        header: options?.header,
      });
      return [...parser.parse(bytes as BufferSource)] as InferCSVRecord<
        Header,
        Options
      >[];
    }

    // Main thread JavaScript execution (default)
    const csv = convertBinaryToString(binary, options ?? {});
    return parseStringToArraySync(csv, options);
  } catch (error) {
    commonParseErrorHandling(error);
  }
}
