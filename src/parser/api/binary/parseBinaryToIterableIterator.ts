import { convertBinaryToString } from "@/converters/binary/convertBinaryToString.ts";
import type { InferCSVRecord, ParseBinaryOptions } from "@/core/types.ts";
import { InternalEngineConfig } from "@/engine/config/InternalEngineConfig.ts";
import { createBinaryCSVParser } from "@/parser/api/model/createBinaryCSVParser.ts";
import { parseStringToIterableIterator } from "@/parser/api/string/parseStringToIterableIterator.ts";
import { commonParseErrorHandling } from "@/utils/error/commonParseErrorHandling.ts";
import { validateBinarySize } from "@/utils/validation/validateBinarySize.ts";

/**
 * Internal generator function for parsing binary data.
 */
function* parseBinaryToIterableIteratorInternal<
  Header extends ReadonlyArray<string>,
  Options extends ParseBinaryOptions<Header> = ParseBinaryOptions<Header>,
>(
  binary: BufferSource,
  options?: Options,
): IterableIterator<InferCSVRecord<Header, Options>> {
  try {
    // Check if WASM engine is requested
    const engineConfig = new InternalEngineConfig(options?.engine);

    if (engineConfig.hasWasm()) {
      // WASM SIMD path: Use optimized binary parser with direct separator detection
      const parser = createBinaryCSVParser<Header>({
        ...options,
        engine: { wasm: true },
      });

      // Yield records directly from parser (lazy evaluation)
      yield* parser.parse(binary) as IterableIterator<
        InferCSVRecord<Header, Options>
      >;
      return;
    }

    // JavaScript path: Convert binary to string and parse
    const csv = convertBinaryToString(binary, options ?? {});
    // Exclude binary-specific options when calling string parser
    const { charset: _charset, fatal: _fatal, ignoreBOM: _ignoreBOM, maxBinarySize: _maxBinarySize, decompression: _decompression, ...stringOptions } = options ?? {};
    yield* parseStringToIterableIterator(csv, stringOptions as any) as IterableIterator<InferCSVRecord<Header, Options>>;
  } catch (error) {
    commonParseErrorHandling(error);
  }
}

/**
 * Parses the given binary data into an iterable iterator of CSV records.
 *
 * @param binary - The binary data to parse (BufferSource: Uint8Array, ArrayBuffer, or other TypedArray).
 * @param options - The parse options.
 * @returns An iterable iterator of CSV records.
 * @throws {RangeError} If the binary size exceeds maxBinarySize limit.
 * @throws {TypeError} If the encoded data is not valid.
 * @throws {ParseError} When an error occurs while parsing the CSV data.
 *
 * @remarks
 * **WARNING**: This function loads the entire binary data into memory before iteration.
 * For large files (>100MB), consider using streaming alternatives like `parseStream()` or `parseBinaryStream()`
 * to avoid memory exhaustion.
 *
 * The default maxBinarySize is 100MB. While this function returns an iterator, the entire
 * binary is converted to a string in memory before iteration begins.
 *
 * When `engine.wasm` is enabled, this function uses WASM SIMD for separator detection,
 * providing 6-8x faster performance for large files (>1MB).
 */
export function parseBinaryToIterableIterator<
  Header extends ReadonlyArray<string>,
  Options extends ParseBinaryOptions<Header> = ParseBinaryOptions<Header>,
>(
  binary: BufferSource,
  options?: Options,
): IterableIterator<InferCSVRecord<Header, Options>> {
  // Validate binary size immediately (before generator starts)
  validateBinarySize(binary, options?.maxBinarySize);

  // Return the internal generator
  return parseBinaryToIterableIteratorInternal(binary, options);
}
