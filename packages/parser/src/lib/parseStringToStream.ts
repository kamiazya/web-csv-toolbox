import type {
  CSVRecord,
  DEFAULT_DELIMITER,
  DEFAULT_QUOTATION,
  ParseOptions,
  PickCSVHeader,
} from "@web-csv-toolbox/common";

import { Lexer } from "./models/Lexer";
import { RecordAssembler } from "./models/RecordAssembler";
import { commonParseErrorHandling } from "./utils/commonParseErrorHandling";

export function parseStringToStream<
  const CSVSource extends string,
  const Delimiter extends string = DEFAULT_DELIMITER,
  const Quotation extends string = DEFAULT_QUOTATION,
  const Header extends ReadonlyArray<string> = PickCSVHeader<
    CSVSource,
    Delimiter,
    Quotation
  >,
>(
  stream: CSVSource,
  options: ParseOptions<Header, Delimiter, Quotation>,
): ReadableStream<CSVRecord<Header>>;
export function parseStringToStream<
  const CSVSource extends string,
  const Header extends ReadonlyArray<string> = PickCSVHeader<CSVSource>,
>(
  stream: CSVSource,
  options?: ParseOptions<Header>,
): ReadableStream<CSVRecord<Header>>;
export function parseStringToStream<const Header extends ReadonlyArray<string>>(
  stream: string,
  options?: ParseOptions<Header>,
): ReadableStream<CSVRecord<Header>>;
export function parseStringToStream<const Header extends ReadonlyArray<string>>(
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
