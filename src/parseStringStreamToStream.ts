import { CSVLexerTransformer } from "./CSVLexerTransformer.ts";
import { CSVRecordAssemblerTransformer } from "./CSVRecordAssemblerTransformer.ts";
import type { CSVRecord, ParseOptions } from "./common/types.ts";
import type { DEFAULT_DELIMITER, DEFAULT_QUOTATION } from "./constants.ts";
import { pipeline } from "./utils/pipeline.ts";
import type { PickCSVHeader } from "./utils/types.ts";

export function parseStringStreamToStream<
  const CSVSource extends ReadableStream<string>,
  const Delimiter extends string = DEFAULT_DELIMITER,
  const Quotation extends string = DEFAULT_QUOTATION,
  const Header extends ReadonlyArray<string> = PickCSVHeader<
    CSVSource,
    Delimiter,
    Quotation
  >,
>(
  stream: CSVSource,
  options: ParseOptions<Header, Delimiter, Quotation>,
): ReadableStream<CSVRecord<Header>>;
export function parseStringStreamToStream<
  const CSVSource extends ReadableStream<string>,
  const Header extends ReadonlyArray<string> = PickCSVHeader<CSVSource>,
>(
  stream: CSVSource,
  options?: ParseOptions<Header>,
): ReadableStream<CSVRecord<Header>>;
export function parseStringStreamToStream<
  const Header extends ReadonlyArray<string>,
>(
  stream: ReadableStream<string>,
  options?: ParseOptions<Header>,
): ReadableStream<CSVRecord<Header>>;
export function parseStringStreamToStream<
  const Header extends ReadonlyArray<string>,
>(
  stream: ReadableStream<string>,
  options?: ParseOptions<Header>,
): ReadableStream<CSVRecord<Header>> {
  return pipeline(
    stream,
    new CSVLexerTransformer(options),
    new CSVRecordAssemblerTransformer(options),
  );
}
