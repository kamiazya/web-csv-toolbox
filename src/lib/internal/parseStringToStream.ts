import { CSVRecord, ParseOptions } from "../common/types.ts";
import { Lexer } from "./Lexer.ts";
import { RecordAssembler } from "./RecordAssembler.ts";

export function parseStringToStream<Header extends ReadonlyArray<string>>(
  csv: string,
  options?: ParseOptions<Header>,
): ReadableStream<CSVRecord<Header>> {
  const lexer = new Lexer(options);
  const assembler = new RecordAssembler(options);
  return new ReadableStream({
    start(controller) {
      const tokens = lexer.lex(csv);
      for (const record of assembler.assemble(tokens)) {
        controller.enqueue(record);
      }
      controller.close();
    },
  });
}
