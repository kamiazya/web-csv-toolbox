import type {
  DEFAULT_DELIMITER,
  DEFAULT_QUOTATION,
} from "../../../core/constants.ts";
import type {
  CSVRecord,
  ParseOptions,
  PickCSVHeader,
} from "../../../core/types.ts";
import { DefaultCSVLexer } from "../../models/DefaultCSVLexer.ts";
import { CSVLexerTransformer } from "../../stream/CSVLexerTransformer.ts";
import { DefaultCSVRecordAssembler } from "../../models/DefaultCSVRecordAssembler.ts";
import { CSVRecordAssemblerTransformer } from "../../stream/CSVRecordAssemblerTransformer.ts";

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
  const lexer = new DefaultCSVLexer(options);
  const assembler = new DefaultCSVRecordAssembler(options);
  return stream
    .pipeThrough(new CSVLexerTransformer(lexer))
    .pipeThrough(new CSVRecordAssemblerTransformer(assembler));
}
