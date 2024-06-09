import { Lexer } from "./Lexer.ts";
import { RecordAssembler } from "./RecordAssembler.ts";
import type { CSVRecord, ParseOptions } from "./common/types.ts";
import { commonParseErrorHandling } from "./commonParseErrorHandling.ts";

export function parseStringToArraySync<Header extends ReadonlyArray<string>>(
  csv: string,
  options?: ParseOptions<Header>,
): CSVRecord<Header>[] {
  try {
    const lexer = new Lexer(options);
    const assembler = new RecordAssembler(options);
    const tokens = lexer.lex(csv);
    return [...assembler.assemble(tokens)];
  } catch (error) {
    commonParseErrorHandling(error);
  }
}
