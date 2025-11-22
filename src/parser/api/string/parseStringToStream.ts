import type { DEFAULT_DELIMITER, DEFAULT_QUOTATION } from "@/core/constants.ts";
import type {
  InferCSVRecord,
  ParseOptions,
  PickCSVHeader,
} from "@/core/types.ts";
import { createCSVRecordAssembler } from "@/parser/models/createCSVRecordAssembler.ts";
import { FlexibleStringCSVLexer } from "@/parser/models/createStringCSVLexer.ts";
import { commonParseErrorHandling } from "@/utils/error/commonParseErrorHandling.ts";

export function parseStringToStream<
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
>(
  stream: CSVSource,
  options: Options,
): ReadableStream<InferCSVRecord<Header, Options>>;
export function parseStringToStream<
  const CSVSource extends string,
  const Header extends ReadonlyArray<string> = PickCSVHeader<CSVSource>,
  const Options extends ParseOptions<Header> = ParseOptions<Header>,
>(
  stream: CSVSource,
  options?: Options,
): ReadableStream<InferCSVRecord<Header, Options>>;
export function parseStringToStream<
  const Header extends ReadonlyArray<string>,
  const Options extends ParseOptions<Header> = ParseOptions<Header>,
>(
  stream: string,
  options?: Options,
): ReadableStream<InferCSVRecord<Header, Options>>;
export function parseStringToStream<
  const Header extends ReadonlyArray<string>,
  const Options extends ParseOptions<Header> = ParseOptions<Header>,
>(
  csv: string,
  options?: Options,
): ReadableStream<InferCSVRecord<Header, Options>> {
  try {
    const lexer = new FlexibleStringCSVLexer(options);
    const assembler = createCSVRecordAssembler<Header>(options);
    return new ReadableStream<InferCSVRecord<Header, Options>>({
      start(controller) {
        const tokens = lexer.lex(csv);
        for (const record of assembler.assemble(tokens)) {
          controller.enqueue(record as InferCSVRecord<Header, Options>);
        }
        controller.close();
      },
    });
  } catch (error) {
    commonParseErrorHandling(error);
  }
}
