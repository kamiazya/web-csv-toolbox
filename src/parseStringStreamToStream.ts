import { LexerTransformer } from "./LexerTransformer.ts";
import { RecordAssemblerTransformer } from "./RecordAssemblerTransformer.ts";
import type { CSVRecord, ParseOptions } from "./common/types.ts";
import type { COMMA, DOUBLE_QUOTE } from "./constants.ts";
import { pipeline } from "./utils/pipeline.ts";
import type { PickCSVHeader } from "./utils/types.ts";

export function parseStringStreamToStream<
  CSVSource extends ReadableStream<string>,
  Delimiter extends string = typeof COMMA,
  Quotation extends string = typeof DOUBLE_QUOTE,
  Header extends ReadonlyArray<string> = PickCSVHeader<
    CSVSource,
    Delimiter,
    Quotation
  >,
>(
  stream: CSVSource,
  options: ParseOptions<Header> & {
    delimiter?: Delimiter;
    quotation?: Quotation;
  },
): ReadableStream<CSVRecord<Header>>;
export function parseStringStreamToStream<
  CSVSource extends ReadableStream<string>,
  Header extends ReadonlyArray<string> = PickCSVHeader<CSVSource>,
>(
  stream: CSVSource,
  options?: ParseOptions<Header>,
): ReadableStream<CSVRecord<Header>>;
export function parseStringStreamToStream<Header extends ReadonlyArray<string>>(
  stream: ReadableStream<string>,
  options?: ParseOptions<Header>,
): ReadableStream<CSVRecord<Header>>;
export function parseStringStreamToStream<Header extends ReadonlyArray<string>>(
  stream: ReadableStream<string>,
  options?: ParseOptions<Header>,
): ReadableStream<CSVRecord<Header>> {
  return pipeline(
    stream,
    new LexerTransformer(options),
    new RecordAssemblerTransformer(options),
  );
}
