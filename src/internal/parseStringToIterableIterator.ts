import { CSVRecord, ParseOptions } from "../common/types.js";
import { Lexer } from "./Lexer.js";
import { RecordAssembler } from "./RecordAssembler.js";

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
