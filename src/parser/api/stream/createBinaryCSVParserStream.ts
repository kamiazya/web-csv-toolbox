import type {
  BinaryCSVParserStreamOptions,
  CSVRecord,
  InferFormat,
  ParseBinaryOptions,
} from "@/core/types.ts";
import { createBinaryCSVParser } from "@/parser/api/model/createBinaryCSVParser.ts";
import { BinaryCSVParserStream } from "@/parser/stream/BinaryCSVParserStream.ts";

/**
 * Factory function to create a BinaryCSVParserStream instance.
 *
 * This function internally creates a BinaryCSVParser and wraps it in a BinaryCSVParserStream,
 * providing a simpler API for stream-based CSV parsing from binary streams.
 *
 * Accepts any BufferSource type (Uint8Array, ArrayBuffer, or other TypedArray views) as input chunks.
 *
 * @category Mid-level API
 *
 * @template Header - The type of the header row
 * @template Options - The parser options type
 * @param options - Binary CSV parser options including header, delimiter, charset, outputFormat, engine, etc.
 * @param streamOptions - Stream-specific options like backpressureCheckInterval
 * @param writableStrategy - Strategy for the writable side (default: `ByteLengthQueuingStrategy({ highWaterMark: 65536 })`)
 * @param readableStrategy - Strategy for the readable side (default: `CountQueuingStrategy({ highWaterMark: 256 })`)
 * @returns A BinaryCSVParserStream instance configured with the specified options
 *
 * @see {@link https://github.com/kamiazya/web-csv-toolbox/blob/main/docs/how-to-guides/choosing-the-right-api.md | Choosing the Right API} for guidance on selecting the appropriate API level.
 *
 * @example Basic usage - parse binary stream to records
 * ```ts
 * import { createBinaryCSVParserStream } from 'web-csv-toolbox';
 *
 * // Directly pipe fetch response body (no TextDecoderStream needed)
 * await fetch('data.csv')
 *   .then(res => res.body)
 *   .pipeThrough(createBinaryCSVParserStream())
 *   .pipeTo(new WritableStream({
 *     write(record) {
 *       console.log(record); // { name: 'Alice', age: '30' }
 *     }
 *   }));
 * ```
 *
 * @example With charset encoding
 * ```ts
 * import { createBinaryCSVParserStream } from 'web-csv-toolbox';
 *
 * // Parse Shift-JIS encoded CSV
 * const stream = createBinaryCSVParserStream({
 *   charset: 'shift-jis',
 *   ignoreBOM: true
 * });
 *
 * binaryStream.pipeThrough(stream);
 * ```
 *
 * @example With predefined header
 * ```ts
 * import { createBinaryCSVParserStream } from 'web-csv-toolbox';
 *
 * // CSV data without header row
 * const stream = createBinaryCSVParserStream({
 *   header: ['name', 'age'] as const,
 *   charset: 'utf-8'
 * });
 *
 * binaryStream
 *   .pipeThrough(stream)
 *   .pipeTo(yourProcessor);
 * ```
 *
 * @example Array output format
 * ```ts
 * import { createBinaryCSVParserStream } from 'web-csv-toolbox';
 *
 * const stream = createBinaryCSVParserStream({
 *   outputFormat: 'array'
 * });
 *
 * binaryStream
 *   .pipeThrough(stream)
 *   .pipeTo(new WritableStream({
 *     write(record) {
 *       console.log(record); // ['Alice', '30']
 *     }
 *   }));
 * ```
 *
 * @example With decompression
 * ```ts
 * import { createBinaryCSVParserStream } from 'web-csv-toolbox';
 *
 * // Parse gzip-compressed CSV
 * const stream = createBinaryCSVParserStream({
 *   decompression: 'gzip'
 * });
 *
 * compressedStream.pipeThrough(stream);
 * ```
 *
 * @example With backpressure tuning
 * ```ts
 * import { createBinaryCSVParserStream } from 'web-csv-toolbox';
 *
 * const stream = createBinaryCSVParserStream(
 *   { header: ['name', 'age'] as const, charset: 'utf-8' },
 *   { backpressureCheckInterval: 50 },
 *   new ByteLengthQueuingStrategy({ highWaterMark: 131072 }),
 *   new CountQueuingStrategy({ highWaterMark: 512 })
 * );
 *
 * await fetch('large-file.csv')
 *   .then(res => res.body)
 *   .pipeThrough(stream)
 *   .pipeTo(yourProcessor);
 * ```
 */
export function createBinaryCSVParserStream<
  Header extends ReadonlyArray<string> = readonly string[],
  Options extends ParseBinaryOptions<
    Header,
    string,
    string
  > = ParseBinaryOptions<Header>,
>(
  options?: Options,
  streamOptions?: BinaryCSVParserStreamOptions,
  writableStrategy?: QueuingStrategy<BufferSource>,
  readableStrategy?: QueuingStrategy<CSVRecord<Header, InferFormat<Options>>>,
): BinaryCSVParserStream<Header, InferFormat<Options>> {
  const parser = createBinaryCSVParser<Header>(options as any);
  return new BinaryCSVParserStream<Header, InferFormat<Options>>(
    parser as any,
    streamOptions ?? {},
    writableStrategy,
    readableStrategy,
  );
}
