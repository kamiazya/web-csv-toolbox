import type { DEFAULT_DELIMITER, DEFAULT_QUOTATION } from "@/core/constants.ts";
import type { CSVRecord, ParseOptions, PickCSVHeader } from "@/core/types.ts";
import { DefaultCSVLexer } from "@/parser/models/DefaultCSVLexer.ts";
import { DefaultCSVRecordAssembler } from "@/parser/models/DefaultCSVRecordAssembler.ts";
import { commonParseErrorHandling } from "@/utils/error/commonParseErrorHandling.ts";

/**
 * Synchronously parses a CSV string into an array of records.
 *
 * @param csv - The CSV string to parse.
 * @param options - Parsing options including delimiter, quotation, header, etc.
 * @returns An array of CSV records.
 * @throws {ParseError} If the CSV data is malformed.
 *
 * @remarks
 * **WARNING**: This function loads all parsed records into memory as an array.
 * For CSV data with a large number of records, consider using `parseStringToIterableIterator()`
 * to iterate over records without loading them all into memory at once.
 *
 * @example
 * ```ts
 * const csv = "name,age\nAlice,30\nBob,25";
 * const records = parseStringToArraySync(csv);
 * // [{ name: "Alice", age: "30" }, { name: "Bob", age: "25" }]
 * ```
 */
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
    const lexer = new DefaultCSVLexer(options);
    const assembler = new DefaultCSVRecordAssembler(options);
    const tokens = lexer.lex(csv);
    return [...assembler.assemble(tokens)];
  } catch (error) {
    commonParseErrorHandling(error);
  }
}
