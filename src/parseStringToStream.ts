import { Lexer } from "./Lexer.ts";
import { RecordAssembler } from "./RecordAssembler.ts";
import type { CSVRecord, ParseOptions, PickCSVHeader } from "./common/types.ts";
import type { COMMA, DOUBLE_QUOTE } from "./constants.ts";

export function parseStringToStream<
  CSVSource extends string,
  Delimiter extends string = typeof COMMA,
  Quotation extends string = typeof DOUBLE_QUOTE,
  Header extends ReadonlyArray<string> = PickCSVHeader<
    CSVSource,
    Delimiter,
    Quotation
  >,
>(
  stream: CSVSource,
  options: ParseOptions<Header> & {
    delimiter?: Delimiter;
    quotation?: Quotation;
  },
): ReadableStream<CSVRecord<Header>>;
export function parseStringToStream<
  CSVSource extends string,
  Header extends ReadonlyArray<string> = PickCSVHeader<CSVSource>,
>(
  stream: CSVSource,
  options?: ParseOptions<Header>,
): ReadableStream<CSVRecord<Header>>;
export function parseStringToStream<Header extends ReadonlyArray<string>>(
  stream: string,
  options?: ParseOptions<Header>,
): ReadableStream<CSVRecord<Header>>;
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
