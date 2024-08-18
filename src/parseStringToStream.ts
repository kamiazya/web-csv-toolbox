import { Lexer } from "./Lexer.ts";
import { RecordAssembler } from "./RecordAssembler.ts";
import type { CSVRecord, ParseOptions } from "./common/types.ts";
import { commonParseErrorHandling } from "./commonParseErrorHandling.ts";
import type { DEFAULT_DELIMITER, DEFAULT_QUOTATION } from "./constants.ts";
import type { PickCSVHeader } from "./utils/types.ts";

export function parseStringToStream<
  CSVSource extends string,
  Delimiter extends string = DEFAULT_DELIMITER,
  Quotation extends string = DEFAULT_QUOTATION,
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
  try {
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
  } catch (error) {
    commonParseErrorHandling(error);
  }
}
