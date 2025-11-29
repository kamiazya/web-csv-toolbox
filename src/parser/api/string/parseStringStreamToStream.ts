import type { DEFAULT_DELIMITER, DEFAULT_QUOTATION } from "@/core/constants.ts";
import type {
  InferCSVRecord,
  ParseOptions,
  PickCSVHeader,
} from "@/core/types.ts";
import { createCSVRecordAssembler } from "@/parser/api/model/createCSVRecordAssembler.ts";
import { createStringCSVLexer } from "@/parser/api/model/createStringCSVLexer.ts";
import { CSVRecordAssemblerTransformer } from "@/parser/stream/CSVRecordAssemblerTransformer.ts";
import { StringCSVLexerTransformer } from "@/parser/stream/StringCSVLexerTransformer.ts";

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
  const lexer = createStringCSVLexer(options);
  const assembler = createCSVRecordAssembler<Header>(options);

  return stream
    .pipeThrough(new StringCSVLexerTransformer(lexer))
    .pipeThrough(
      new CSVRecordAssemblerTransformer(assembler),
    ) as ReadableStream<InferCSVRecord<Header, Options>>;
}
