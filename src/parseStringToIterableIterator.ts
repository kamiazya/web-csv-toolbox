import { CSVLexer } from "./CSVLexer.ts";
import { CSVRecordAssembler } from "./CSVRecordAssembler.ts";
import type { CSVRecord, ParseOptions } from "./common/types.ts";
import { commonParseErrorHandling } from "./commonParseErrorHandling.ts";
import type { DEFAULT_DELIMITER, DEFAULT_QUOTATION } from "./constants.ts";
import type { PickCSVHeader } from "./utils/types.ts";

export function parseStringToIterableIterator<
  const CSVSource extends string,
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
): IterableIterator<CSVRecord<Header>>;
export function parseStringToIterableIterator<
  const CSVSource extends string,
  const Header extends ReadonlyArray<string> = PickCSVHeader<CSVSource>,
>(
  stream: CSVSource,
  options?: ParseOptions<Header>,
): IterableIterator<CSVRecord<Header>>;
export function parseStringToIterableIterator<
  const Header extends ReadonlyArray<string>,
>(
  stream: string,
  options?: ParseOptions<Header>,
): IterableIterator<CSVRecord<Header>>;
export function parseStringToIterableIterator<
  const Header extends ReadonlyArray<string>,
>(
  csv: string,
  options?: ParseOptions<Header>,
): IterableIterator<CSVRecord<Header>> {
  try {
    const lexer = new CSVLexer(options);
    const assembler = new CSVRecordAssembler(options);
    const tokens = lexer.lex(csv);
    return assembler.assemble(tokens);
  } catch (error) {
    commonParseErrorHandling(error);
  }
}
