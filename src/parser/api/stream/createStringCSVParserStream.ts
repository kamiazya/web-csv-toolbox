import type {
  CSVRecord,
  InferFormat,
  ParseOptions,
  StringCSVParserStreamOptions,
} from "@/core/types.ts";
import { createStringCSVParser } from "@/parser/api/model/createStringCSVParser.ts";
import { StringCSVParserStream } from "@/parser/stream/StringCSVParserStream.ts";

/**
 * Factory function to create a StringCSVParserStream instance.
 *
 * This function internally creates a StringCSVParser and wraps it in a StringCSVParserStream,
 * providing a simpler API for stream-based CSV parsing from string streams.
 *
 * @category Mid-level API
 *
 * @template Header - The type of the header row
 * @template Options - The parser options type
 * @param options - CSV parser options including header, delimiter, outputFormat, engine, etc.
 * @param streamOptions - Stream-specific options like backpressureCheckInterval
 * @param writableStrategy - Strategy for the writable side (default: `{ highWaterMark: 65536, size: chunk => chunk.length }`)
 * @param readableStrategy - Strategy for the readable side (default: `{ highWaterMark: 256, size: () => 1 }`)
 * @returns A StringCSVParserStream instance configured with the specified options
 *
 * @see {@link https://github.com/kamiazya/web-csv-toolbox/blob/main/docs/how-to-guides/choosing-the-right-api.md | Choosing the Right API} for guidance on selecting the appropriate API level.
 *
 * @example Basic usage - parse string stream to records
 * ```ts
 * import { createStringCSVParserStream } from 'web-csv-toolbox';
 *
 * await fetch('data.csv')
 *   .then(res => res.body)
 *   .pipeThrough(new TextDecoderStream())
 *   .pipeThrough(createStringCSVParserStream())
 *   .pipeTo(new WritableStream({
 *     write(record) {
 *       console.log(record); // { name: 'Alice', age: '30' }
 *     }
 *   }));
 * ```
 *
 * @example With predefined header
 * ```ts
 * import { createStringCSVParserStream } from 'web-csv-toolbox';
 *
 * // CSV data without header row
 * const stream = createStringCSVParserStream({
 *   header: ['name', 'age'] as const
 * });
 *
 * stringStream
 *   .pipeThrough(stream)
 *   .pipeTo(yourProcessor);
 * ```
 *
 * @example Array output format
 * ```ts
 * import { createStringCSVParserStream } from 'web-csv-toolbox';
 *
 * const stream = createStringCSVParserStream({
 *   outputFormat: 'array'
 * });
 *
 * stringStream
 *   .pipeThrough(stream)
 *   .pipeTo(new WritableStream({
 *     write(record) {
 *       console.log(record); // ['Alice', '30']
 *     }
 *   }));
 * ```
 *
 * @example With custom delimiter (TSV)
 * ```ts
 * import { createStringCSVParserStream } from 'web-csv-toolbox';
 *
 * const tsvStream = createStringCSVParserStream({
 *   delimiter: '\t'
 * });
 *
 * tsvStringStream.pipeThrough(tsvStream);
 * ```
 *
 * @example With backpressure tuning
 * ```ts
 * import { createStringCSVParserStream } from 'web-csv-toolbox';
 *
 * const stream = createStringCSVParserStream(
 *   { header: ['name', 'age'] as const },
 *   { backpressureCheckInterval: 50 },
 *   { highWaterMark: 131072, size: (chunk) => chunk.length },
 *   new CountQueuingStrategy({ highWaterMark: 512 })
 * );
 *
 * await fetch('large-file.csv')
 *   .then(res => res.body)
 *   .pipeThrough(new TextDecoderStream())
 *   .pipeThrough(stream)
 *   .pipeTo(yourProcessor);
 * ```
 */
export function createStringCSVParserStream<
  Header extends ReadonlyArray<string> = readonly string[],
  Options extends ParseOptions<Header, string, string> = ParseOptions<Header>,
>(
  options?: Options,
  streamOptions?: StringCSVParserStreamOptions,
  writableStrategy?: QueuingStrategy<string>,
  readableStrategy?: QueuingStrategy<CSVRecord<Header, InferFormat<Options>>>,
): StringCSVParserStream<Header, InferFormat<Options>> {
  const parser = createStringCSVParser<Header>(options as any);
  return new StringCSVParserStream<Header, InferFormat<Options>>(
    parser as any,
    streamOptions ?? {},
    writableStrategy,
    readableStrategy,
  );
}
