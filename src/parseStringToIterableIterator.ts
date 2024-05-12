import { Lexer } from "./Lexer.ts";
import { RecordAssembler } from "./RecordAssembler.ts";
import type { CSVRecord, ParseOptions } from "./common/types.ts";
import type { COMMA, DOUBLE_QUOTE } from "./constants.ts";
import type { PickCSVHeader } from "./utils/types.ts";

export function parseStringToIterableIterator<
  CSVSource extends string,
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
): IterableIterator<CSVRecord<Header>>;
export function parseStringToIterableIterator<
  CSVSource extends string,
  Header extends ReadonlyArray<string> = PickCSVHeader<CSVSource>,
>(
  stream: CSVSource,
  options?: ParseOptions<Header>,
): IterableIterator<CSVRecord<Header>>;
export function parseStringToIterableIterator<
  Header extends ReadonlyArray<string>,
>(
  stream: string,
  options?: ParseOptions<Header>,
): IterableIterator<CSVRecord<Header>>;
export function parseStringToIterableIterator<
  Header extends ReadonlyArray<string>,
>(
  csv: string,
  options?: ParseOptions<Header>,
): IterableIterator<CSVRecord<Header>> {
  const lexer = new Lexer(options);
  const assembler = new RecordAssembler(options);
  const tokens = lexer.lex(csv);
  return assembler.assemble(tokens);
}
