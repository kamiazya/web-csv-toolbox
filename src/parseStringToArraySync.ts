import { Lexer } from "./Lexer.ts";
import { RecordAssembler } from "./RecordAssembler.ts";
import type {
  CSVRecord,
  ParseOptions,
  PickCSVHeader,
  ToParsedCSVRecords,
} from "./common/types.ts";
import type { COMMA, DOUBLE_QUOTE } from "./constants.ts";

export function parseStringToArraySync<
  CSVSource extends string,
  Delimiter extends string = typeof COMMA,
  Quotation extends string = typeof DOUBLE_QUOTE,
  Header extends ReadonlyArray<string> = PickCSVHeader<
    CSVSource,
    Delimiter,
    Quotation
  >,
>(
  csv: CSVSource,
  options: ParseOptions<Header> & {
    delimiter?: Delimiter;
    quotation?: Quotation;
  },
): ToParsedCSVRecords<CSVSource, Delimiter, Quotation> extends infer R extends
  CSVRecord<readonly string[]>[]
  ? R
  : CSVRecord<Header>[];
export function parseStringToArraySync<
  CSVSource extends string,
  Header extends ReadonlyArray<string> = PickCSVHeader<CSVSource>,
>(
  csv: CSVSource,
  options?: ParseOptions<Header>,
): ToParsedCSVRecords<CSVSource> extends infer R extends CSVRecord<
  readonly string[]
>[]
  ? R
  : CSVRecord<Header>[];
export function parseStringToArraySync<Header extends ReadonlyArray<string>>(
  csv: string,
  options?: ParseOptions<Header>,
): CSVRecord<Header>[];
export function parseStringToArraySync<Header extends ReadonlyArray<string>>(
  csv: string,
  options?: ParseOptions<Header>,
): CSVRecord<Header>[] {
  const lexer = new Lexer(options);
  const assembler = new RecordAssembler(options);
  const tokens = lexer.lex(csv);
  return [...assembler.assemble(tokens)];
}
