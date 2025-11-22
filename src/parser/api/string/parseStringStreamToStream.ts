import type { DEFAULT_DELIMITER, DEFAULT_QUOTATION } from "@/core/constants.ts";
import type {
  InferCSVRecord,
  ParseOptions,
  PickCSVHeader,
} from "@/core/types.ts";
import { createCSVRecordAssembler } from "@/parser/models/createCSVRecordAssembler.ts";
import { FlexibleStringCSVLexer } from "@/parser/models/createStringCSVLexer.ts";
import { CSVLexerTransformer } from "@/parser/stream/CSVLexerTransformer.ts";
import { CSVRecordAssemblerTransformer } from "@/parser/stream/CSVRecordAssemblerTransformer.ts";

export function parseStringStreamToStream<
  const CSVSource extends ReadableStream<string>,
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
export function parseStringStreamToStream<
  const CSVSource extends ReadableStream<string>,
  const Header extends ReadonlyArray<string> = PickCSVHeader<CSVSource>,
  const Options extends ParseOptions<Header> = ParseOptions<Header>,
>(
  stream: CSVSource,
  options?: Options,
): ReadableStream<InferCSVRecord<Header, Options>>;
export function parseStringStreamToStream<
  const Header extends ReadonlyArray<string>,
  const Options extends ParseOptions<Header> = ParseOptions<Header>,
>(
  stream: ReadableStream<string>,
  options?: Options,
): ReadableStream<InferCSVRecord<Header, Options>>;
export function parseStringStreamToStream<
  const Header extends ReadonlyArray<string>,
  const Options extends ParseOptions<Header> = ParseOptions<Header>,
>(
  stream: ReadableStream<string>,
  options?: Options,
): ReadableStream<InferCSVRecord<Header, Options>> {
  const lexer = new FlexibleStringCSVLexer(options);
  const assembler = createCSVRecordAssembler<Header>(options);

  return stream
    .pipeThrough(new CSVLexerTransformer(lexer))
    .pipeThrough(
      new CSVRecordAssemblerTransformer(assembler),
    ) as ReadableStream<InferCSVRecord<Header, Options>>;
}
