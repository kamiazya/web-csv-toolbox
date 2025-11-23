import type { DEFAULT_DELIMITER, DEFAULT_QUOTATION } from "@/core/constants.ts";
import type {
  InferCSVRecord,
  ParseOptions,
  PickCSVHeader,
} from "@/core/types.ts";
import { createCSVRecordAssembler } from "@/parser/api/model/createCSVRecordAssembler.ts";
import { createStringCSVLexer } from "@/parser/api/model/createStringCSVLexer.ts";
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
  const Options extends ParseOptions<
    Header,
    Delimiter,
    Quotation
  > = ParseOptions<Header, Delimiter, Quotation>,
>(csv: CSVSource, options: Options): InferCSVRecord<Header, Options>[];
export function parseStringToArraySync<
  const CSVSource extends string,
  const Header extends ReadonlyArray<string> = PickCSVHeader<CSVSource>,
  const Options extends ParseOptions<Header> = ParseOptions<Header>,
>(csv: CSVSource, options?: Options): InferCSVRecord<Header, Options>[];
export function parseStringToArraySync<
  const Header extends ReadonlyArray<string>,
  const Options extends ParseOptions<Header> = ParseOptions<Header>,
>(csv: string, options?: Options): InferCSVRecord<Header, Options>[];
export function parseStringToArraySync<
  const Header extends ReadonlyArray<string>,
  const Options extends ParseOptions<Header> = ParseOptions<Header>,
>(csv: string, options?: Options): InferCSVRecord<Header, Options>[] {
  try {
    const lexer = createStringCSVLexer(options);
    const assembler = createCSVRecordAssembler(options);
    const tokens = lexer.lex(csv);
    return [...assembler.assemble(tokens)] as InferCSVRecord<Header, Options>[];
  } catch (error) {
    commonParseErrorHandling(error);
  }
}
