import type {
  CSVObjectRecord,
  CSVParserParseOptions,
  StringCSVProcessingOptions,
  StringObjectCSVParser,
} from "@/core/types.ts";
import {
  ensureTrailingLineFeed,
  scanUtf16StreamingChunk,
} from "@/parser/models/utils/utf16WasmHelpers.ts";
import {
  createAssemblerState,
  type DirectAssemblerConfig,
  type DirectAssemblerState,
  flushObjectRecord,
  separatorsToObjectRecords,
} from "@/parser/utils/directRecordAssembler.ts";

/**
 * UTF-16 optimized Wasm parser for string inputs (object output format).
 *
 * Keeps data in UTF-16 code units to avoid TextEncoder/TextDecoder overhead.
 */
export class WasmStringUtf16ObjectCSVParser<
  Header extends ReadonlyArray<string> = readonly string[],
> implements StringObjectCSVParser<Header>
{
  private readonly config: DirectAssemblerConfig<Header>;
  private state: DirectAssemblerState;
  private readonly delimiterCode: number;
  private readonly quotationCode: number;
  private leftover = "";
  private prevInQuote = false;

  constructor(options: StringCSVProcessingOptions<Header>) {
    this.config = {
      header: options.header,
      quotation: options.quotation,
      columnCountStrategy: options.columnCountStrategy ?? "pad",
      skipEmptyLines: options.skipEmptyLines,
      maxFieldCount: options.maxFieldCount,
      source: options.source,
    };
    this.state = createAssemblerState(this.config);
    this.delimiterCode = (options.delimiter ?? ",").charCodeAt(0);
    this.quotationCode = (options.quotation ?? '"').charCodeAt(0);
  }

  *parse(
    chunk?: string,
    options?: CSVParserParseOptions,
  ): IterableIterator<CSVObjectRecord<Header>> {
    const streamMode = options?.stream ?? false;

    if (chunk === undefined) {
      yield* this.flush();
      return;
    }

    if (!streamMode) {
      if (chunk.length === 0) {
        return;
      }
      const result = scanUtf16StreamingChunk(
        chunk,
        this.delimiterCode,
        this.quotationCode,
        this.prevInQuote,
      );

      const slice = chunk.slice(0, result.endCharOffset);
      const separatorSlice = ensureTrailingLineFeed(
        result.separators,
        result.sepCount,
        slice.length,
      );
      yield* separatorsToObjectRecords(
        separatorSlice.separators,
        separatorSlice.sepCount,
        slice,
        this.config,
        this.state,
      );

      yield* flushObjectRecord(this.config, this.state);
      this.prevInQuote = result.endInQuote;
      this.leftover = "";
      this.resetState();
      return;
    }

    if (chunk.length === 0 && this.leftover.length === 0) {
      return;
    }

    const combined = this.leftover.length > 0 ? this.leftover + chunk : chunk;
    if (combined.length === 0) {
      return;
    }

    const result = scanUtf16StreamingChunk(
      combined,
      this.delimiterCode,
      this.quotationCode,
      this.prevInQuote,
    );

    if (result.processedSepCount > 0 || result.processedChars > 0) {
      yield* separatorsToObjectRecords(
        result.separators,
        result.processedSepCount,
        combined.slice(0, result.processedChars),
        this.config,
        this.state,
      );
    }

    this.leftover = combined.slice(result.processedChars);
    this.prevInQuote = result.endInQuote;
  }

  private *flush(): IterableIterator<CSVObjectRecord<Header>> {
    if (this.leftover.length > 0) {
      const result = scanUtf16StreamingChunk(
        this.leftover,
        this.delimiterCode,
        this.quotationCode,
        this.prevInQuote,
      );

      if (result.sepCount > 0 || this.leftover.length > 0) {
        const slice = this.leftover.slice(0, result.endCharOffset);
        const separatorSlice = ensureTrailingLineFeed(
          result.separators,
          result.sepCount,
          slice.length,
        );
        yield* separatorsToObjectRecords(
          separatorSlice.separators,
          separatorSlice.sepCount,
          slice,
          this.config,
          this.state,
        );
      }

      this.leftover = "";
      this.prevInQuote = result.endInQuote;
    }

    yield* flushObjectRecord(this.config, this.state);
    this.resetState();
  }

  private resetState(): void {
    this.state = createAssemblerState(this.config);
    this.leftover = "";
    this.prevInQuote = false;
  }
}
