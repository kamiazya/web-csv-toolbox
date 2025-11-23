import type {
  CSVParserParseOptions,
  CSVProcessingOptions,
  CSVRecord,
} from "@/core/types.ts";
import { createCSVRecordAssembler } from "@/parser/api/model/createCSVRecordAssembler.ts";
import { FlexibleStringCSVLexer } from "@/parser/models/FlexibleStringCSVLexer.ts";

/**
 * Base class for String CSV Parsers.
 * Provides common implementation for both object and array output formats.
 *
 * @template Header - The type of the header row
 * @template Format - Output format: 'object' or 'array'
 *
 * @remarks
 * This is an internal base class. Use FlexibleStringObjectCSVParser or
 * FlexibleStringArrayCSVParser for concrete implementations, or use the
 * createStringCSVParser() factory function for type-safe instantiation.
 *
 * Uses {@link CSVProcessingOptions} which excludes execution strategy (engine).
 * Low-level parsers focus on CSV processing logic only.
 */
export abstract class BaseStringCSVParser<
  Header extends ReadonlyArray<string>,
  Format extends "object" | "array",
> {
  protected readonly lexer: FlexibleStringCSVLexer;
  protected readonly assembler: ReturnType<typeof createCSVRecordAssembler>;

  constructor(options: CSVProcessingOptions<Header> = {}) {
    this.lexer = new FlexibleStringCSVLexer(options);
    this.assembler = createCSVRecordAssembler(options);
  }

  /**
   * Parse a chunk of CSV string data
   *
   * @param chunk - CSV string chunk to parse (optional for flush)
   * @param options - Parse options
   * @returns Iterable iterator of parsed CSV records
   */
  parse(
    chunk?: string,
    options?: CSVParserParseOptions,
  ): IterableIterator<CSVRecord<Header, Format>> {
    const tokens = this.lexer.lex(chunk, options);
    return this.assembler.assemble(tokens, options) as IterableIterator<
      CSVRecord<Header, Format>
    >;
  }
}
