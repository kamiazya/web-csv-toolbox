import { CSVRecord, ParseOptions } from "../common/types.js";
import { Lexer } from "./Lexer.js";
import { RecordAssembler } from "./RecordAssembler.js";

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
