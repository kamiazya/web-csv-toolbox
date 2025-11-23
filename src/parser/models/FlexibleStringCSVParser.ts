import type {
  CSVParserParseOptions,
  CSVRecord,
  ParseOptions,
} from "@/core/types.ts";
import { createCSVRecordAssembler } from "@/parser/models/createCSVRecordAssembler.ts";
import { FlexibleStringCSVLexer } from "@/parser/models/FlexibleStringCSVLexer.ts";

/**
 * Flexible CSV Parser for string input.
 * Combines StringCSVLexer and CSVRecordAssembler for efficient CSV parsing.
 *
 * @template Header - The type of the header row
 * @template Format - Output format type ('object' | 'array')
 *
 * @example
 * ```ts
 * const parser = new FlexibleStringCSVParser({ header: ['name', 'age'] });
 * const records = parser.parse('Alice,30\nBob,25');
 * console.log([...records]); // [{ name: 'Alice', age: '30' }, { name: 'Bob', age: '25' }]
 * ```
 *
 * @example Streaming mode
 * ```ts
 * const parser = new FlexibleStringCSVParser({ header: ['name', 'age'] });
 * const chunk1 = parser.parse('Alice,30\nBob,', { stream: true });
 * const chunk2 = parser.parse('25\nCharlie,35'); // flush
 * ```
 */
export class FlexibleStringCSVParser<
  Header extends ReadonlyArray<string> = readonly string[],
> {
  #lexer: FlexibleStringCSVLexer;
  #assembler: ReturnType<typeof createCSVRecordAssembler>;

  constructor(options: ParseOptions<Header> = {} as ParseOptions<Header>) {
    this.#lexer = new FlexibleStringCSVLexer(options);
    this.#assembler = createCSVRecordAssembler(options);
  }

  /**
   * Parse a chunk of CSV string data
   *
   * @param chunk - CSV string chunk to parse (optional for flush)
   * @param options - Parse options
   * @returns Array of parsed CSV records (type depends on outputFormat option)
   *
   * @example Object format (default)
   * ```ts
   * const parser = new FlexibleStringCSVParser({ header: ['name', 'age'] });
   * const records = parser.parse('Alice,30\nBob,25');
   * console.log(records); // [{ name: 'Alice', age: '30' }, { name: 'Bob', age: '25' }]
   * ```
   *
   * @example Array format
   * ```ts
   * const parser = new FlexibleStringCSVParser({
   *   header: ['name', 'age'],
   *   outputFormat: 'array'
   * });
   * const records = parser.parse('Alice,30\nBob,25');
   * console.log(records); // [['Alice', '30'], ['Bob', '25']]
   * ```
   */
  parse(chunk?: string, options?: CSVParserParseOptions): CSVRecord<Header>[] {
    const tokens = this.#lexer.lex(chunk, options);
    const records = this.#assembler.assemble(tokens, options);
    return Array.from(records) as CSVRecord<Header>[];
  }
}
