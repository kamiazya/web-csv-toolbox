import { convertBinaryToString } from "@/converters/binary/convertBinaryToString.ts";
import type { InferCSVRecord, ParseBinaryOptions } from "@/core/types.ts";
import { InternalEngineConfig } from "@/engine/config/InternalEngineConfig.ts";
import { createBinaryCSVParser } from "@/parser/api/model/createBinaryCSVParser.ts";
import { parseStringToArraySync } from "@/parser/api/string/parseStringToArraySync.ts";
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
 * When `engine.wasm` is enabled, this function uses WASM SIMD for separator detection,
 * providing 6-8x faster performance for large files (>1MB).
 *
 * @example
 * ```ts
 * const binary = new TextEncoder().encode("name,age\nAlice,30");
 * const records = parseBinaryToArraySync(binary);
 * // [{ name: "Alice", age: "30" }]
 * ```
 *
 * @example With WASM SIMD acceleration
 * ```ts
 * import { loadWASMSync } from 'web-csv-toolbox';
 *
 * loadWASMSync();
 * const binary = new TextEncoder().encode("name,age\nAlice,30");
 * const records = parseBinaryToArraySync(binary, { engine: { wasm: true } });
 * // [{ name: "Alice", age: "30" }]
 * ```
 */
export function parseBinaryToArraySync<
  Header extends ReadonlyArray<string>,
  Options extends ParseBinaryOptions<Header> = ParseBinaryOptions<Header>,
>(binary: BufferSource, options?: Options): InferCSVRecord<Header, Options>[] {
  try {
    // Check if WASM engine is requested
    const engineConfig = new InternalEngineConfig(options?.engine);

    if (engineConfig.hasWasm()) {
      // WASM SIMD path: Use optimized binary parser with direct separator detection
      const parser = createBinaryCSVParser<Header>({
        ...options,
        engine: { wasm: true },
      });

      // Collect all records from parser
      const records: InferCSVRecord<Header, Options>[] = [];
      for (const record of parser.parse(binary)) {
        records.push(record as InferCSVRecord<Header, Options>);
      }
      return records;
    }

    // JavaScript path: Convert binary to string and parse
    const csv = convertBinaryToString(binary, options ?? {});
    // Exclude binary-specific options when calling string parser
    const { charset: _charset, fatal: _fatal, ignoreBOM: _ignoreBOM, maxBinarySize: _maxBinarySize, decompression: _decompression, ...stringOptions } = options ?? {};
    return parseStringToArraySync(csv, stringOptions as any) as InferCSVRecord<Header, Options>[];
  } catch (error) {
    commonParseErrorHandling(error);
  }
}
