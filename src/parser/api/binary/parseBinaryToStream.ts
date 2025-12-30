import type { DEFAULT_DELIMITER, DEFAULT_QUOTATION } from "@/core/constants.ts";
import type { InferCSVRecord, ParseBinaryOptions } from "@/core/types.ts";
import { parseBinaryStreamToStream } from "@/parser/api/binary/parseBinaryStreamToStream.ts";
import { commonParseErrorHandling } from "@/utils/error/commonParseErrorHandling.ts";

/**
 * Parses binary CSV data into a ReadableStream of records.
 *
 * @param binary - The binary CSV data to parse (BufferSource: Uint8Array, ArrayBuffer, or other TypedArray).
 * @param options - Parsing options.
 * @returns A ReadableStream of CSV records.
 * @throws {RangeError} If the binary size exceeds maxBinarySize limit.
 * @throws {TypeError} If the encoded data is not valid.
 * @throws {ParseError} When an error occurs while parsing the CSV data.
 *
 * @remarks
 * This function now uses GPU/WASM acceleration when available through `parseBinaryStreamToStream`.
 * The execution priority is: WebGPU > WASM > JavaScript.
 */
export function parseBinaryToStream<
  Header extends ReadonlyArray<string>,
  Delimiter extends string = DEFAULT_DELIMITER,
  Quotation extends string = DEFAULT_QUOTATION,
  Options extends ParseBinaryOptions<
    Header,
    Delimiter,
    Quotation
  > = ParseBinaryOptions<Header, Delimiter, Quotation>,
>(
  binary: BufferSource,
  options?: Options,
): ReadableStream<InferCSVRecord<Header, Options>> {
  try {
    // Convert BufferSource to ReadableStream
    const binaryStream = new ReadableStream<Uint8Array>({
      start(controller) {
        // Convert BufferSource to Uint8Array if needed
        const uint8Array = binary instanceof Uint8Array
          ? binary
          : new Uint8Array(
              binary instanceof ArrayBuffer
                ? binary
                : binary.buffer.slice(
                    binary.byteOffset,
                    binary.byteOffset + binary.byteLength,
                  ),
            );
        controller.enqueue(uint8Array);
        controller.close();
      },
    });

    // Use parseBinaryStreamToStream which has GPU/WASM support
    return parseBinaryStreamToStream<Header, Delimiter, Quotation, Options>(
      binaryStream,
      options,
    );
  } catch (error) {
    commonParseErrorHandling(error);
  }
}
