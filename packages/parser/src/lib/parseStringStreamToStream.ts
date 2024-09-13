import type {
  CSVRecord,
  DEFAULT_DELIMITER,
  DEFAULT_QUOTATION,
  ParseOptions,
  PickCSVHeader,
} from "@web-csv-toolbox/common";
import { pipeline } from "@web-csv-toolbox/shared";

import { LexerTransformer } from "./models/LexerTransformer.ts";
import { RecordAssemblerTransformer } from "./models/RecordAssemblerTransformer.ts";

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
    new LexerTransformer(options),
    new RecordAssemblerTransformer(options),
  );
}
