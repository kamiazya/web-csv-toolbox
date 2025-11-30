import type { DEFAULT_DELIMITER, DEFAULT_QUOTATION } from "@/core/constants.ts";
import type {
  InferCSVRecord,
  ParseOptions,
  PickCSVHeader,
} from "@/core/types.ts";
import { InternalEngineConfig } from "@/engine/config/InternalEngineConfig.ts";
import { createCSVRecordAssembler } from "@/parser/api/model/createCSVRecordAssembler.ts";
import { createStringCSVLexer } from "@/parser/api/model/createStringCSVLexer.ts";
import { createStringCSVParser } from "@/parser/api/model/createStringCSVParser.ts";
import { commonParseErrorHandling } from "@/utils/error/commonParseErrorHandling.ts";

export function parseStringToIterableIterator<
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
): IterableIterator<InferCSVRecord<Header, Options>>;
export function parseStringToIterableIterator<
  const CSVSource extends string,
  const Header extends ReadonlyArray<string> = PickCSVHeader<CSVSource>,
  const Options extends ParseOptions<Header> = ParseOptions<Header>,
>(
  stream: CSVSource,
  options?: Options,
): IterableIterator<InferCSVRecord<Header, Options>>;
export function parseStringToIterableIterator<
  const Header extends ReadonlyArray<string>,
  const Options extends ParseOptions<Header> = ParseOptions<Header>,
>(
  stream: string,
  options?: Options,
): IterableIterator<InferCSVRecord<Header, Options>>;
export function parseStringToIterableIterator<
  const Header extends ReadonlyArray<string>,
  const Options extends ParseOptions<Header> = ParseOptions<Header>,
>(
  csv: string,
  options?: Options,
): IterableIterator<InferCSVRecord<Header, Options>> {
  try {
    // Check if WASM engine is requested
    const engineConfig = new InternalEngineConfig(options?.engine);

    if (engineConfig.hasWasm()) {
      // WASM SIMD path: Use optimized string parser with direct separator detection
      const parser = createStringCSVParser<Header>({
        ...options,
        engine: { wasm: true },
      });

      // Return generator that yields from parser
      return parser.parse(csv) as IterableIterator<
        InferCSVRecord<Header, Options>
      >;
    }

    // JavaScript execution
    const lexer = createStringCSVLexer(options);
    const assembler = createCSVRecordAssembler(options);
    const tokens = lexer.lex(csv);
    return assembler.assemble(tokens) as IterableIterator<
      InferCSVRecord<Header, Options>
    >;
  } catch (error) {
    commonParseErrorHandling(error);
  }
}
