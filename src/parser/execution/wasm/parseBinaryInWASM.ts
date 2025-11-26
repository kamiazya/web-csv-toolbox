import { convertBinaryToUint8Array } from "@/converters/binary/convertBinaryToUint8Array.ts";
import { DEFAULT_BINARY_MAX_SIZE } from "@/core/constants.ts";
import type {
  CSVArrayRecord,
  CSVRecord,
  ParseBinaryOptions,
} from "@/core/types.ts";
import { WASMBinaryCSVArrayParser } from "@/parser/models/WASMBinaryCSVArrayParser.ts";
import { WASMBinaryObjectCSVParser } from "@/parser/models/WASMBinaryObjectCSVParser.ts";
import { validateWASMCharset } from "@/parser/utils/wasmValidation.ts";

/**
 * Parse CSV binary using WebAssembly in main thread.
 *
 * @internal
 * @param binary - CSV binary to parse
 * @param options - Parsing options
 * @returns Async iterable iterator of records
 * @throws {RangeError} If the binary size exceeds maxBinarySize limit or charset is not supported.
 * @throws {TypeError} If the encoded data is not valid for the specified charset.
 *
 * @remarks
 * WASM module is automatically initialized on first use if not already loaded.
 * However, it is recommended to call {@link loadWASM} beforehand for better performance.
 *
 * Uses optimized WASM binary parser with direct byte processing.
 * WASM parser has limitations:
 * - Only supports UTF-8 encoding
 * - Only supports double-quote (") as quotation character
 */
export async function* parseBinaryInWASM<Header extends ReadonlyArray<string>>(
  binary: BufferSource,
  options?: ParseBinaryOptions<Header>,
): AsyncIterableIterator<CSVRecord<Header> | CSVArrayRecord<Header>> {
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
    // Use array parser for array output
    const parser = new WASMBinaryCSVArrayParser<Header>({
      delimiter: options?.delimiter ?? ",",
      quotation: options?.quotation ?? '"',
      maxFieldCount: options?.maxFieldCount,
      header: options?.header,
    });

    for (const record of parser.parse(bytes as BufferSource)) {
      yield record;
    }
  } else {
    // Use object parser for object output (default)
    const parser = new WASMBinaryObjectCSVParser<Header>({
      delimiter: options?.delimiter ?? ",",
      quotation: options?.quotation ?? '"',
      maxFieldCount: options?.maxFieldCount,
      header: options?.header,
    });

    for (const record of parser.parse(bytes as BufferSource)) {
      yield record;
    }
  }
}
