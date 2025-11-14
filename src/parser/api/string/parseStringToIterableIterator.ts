import type { DEFAULT_DELIMITER, DEFAULT_QUOTATION } from "@/core/constants.ts";
import type { CSVRecord, ParseOptions, PickCSVHeader } from "@/core/types.ts";
import { DefaultCSVRecordAssembler } from "@/parser/models/DefaultCSVRecordAssembler.ts";
import { DefaultStringCSVLexer } from "@/parser/models/DefaultStringCSVLexer.ts";
import { commonParseErrorHandling } from "@/utils/error/commonParseErrorHandling.ts";

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
    const lexer = new DefaultStringCSVLexer(options);
    const assembler = new DefaultCSVRecordAssembler(options);
    const tokens = lexer.lex(csv);
    return assembler.assemble(tokens);
  } catch (error) {
    commonParseErrorHandling(error);
  }
}
