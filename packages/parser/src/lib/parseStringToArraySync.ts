import type {
  CSVRecord,
  DEFAULT_DELIMITER,
  DEFAULT_QUOTATION,
  ParseOptions,
  PickCSVHeader,
} from "@web-csv-toolbox/common";

import { Lexer } from "./models/Lexer.ts";
import { RecordAssembler } from "./models/RecordAssembler.ts";
import { commonParseErrorHandling } from "./utils/commonParseErrorHandling.ts";

export function parseStringToArraySync<
  const CSVSource extends string,
  const Delimiter extends string = DEFAULT_DELIMITER,
  const Quotation extends string = DEFAULT_QUOTATION,
  const Header extends ReadonlyArray<string> = PickCSVHeader<
    CSVSource,
    Delimiter,
    Quotation
  >,
>(
  csv: CSVSource,
  options: ParseOptions<Header, Delimiter, Quotation>,
): CSVRecord<Header>[];
export function parseStringToArraySync<
  const CSVSource extends string,
  const Header extends ReadonlyArray<string> = PickCSVHeader<CSVSource>,
>(csv: CSVSource, options?: ParseOptions<Header>): CSVRecord<Header>[];
export function parseStringToArraySync<
  const Header extends ReadonlyArray<string>,
>(csv: string, options?: ParseOptions<Header>): CSVRecord<Header>[];
export function parseStringToArraySync<
  const Header extends ReadonlyArray<string>,
>(csv: string, options?: ParseOptions<Header>): CSVRecord<Header>[] {
  try {
    const lexer = new Lexer(options);
    const assembler = new RecordAssembler(options);
    const tokens = lexer.lex(csv);
    return [...assembler.assemble(tokens)];
  } catch (error) {
    commonParseErrorHandling(error);
  }
}
