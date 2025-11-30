import type { DEFAULT_DELIMITER, DEFAULT_QUOTATION } from "@/core/constants.ts";
import type {
  InferCSVRecord,
  ParseOptions,
  PickCSVHeader,
} from "@/core/types.ts";
import { InternalEngineConfig } from "@/engine/config/InternalEngineConfig.ts";
import { createCSVRecordAssembler } from "@/parser/api/model/createCSVRecordAssembler.ts";
import { createStringCSVLexer } from "@/parser/api/model/createStringCSVLexer.ts";
import { WASMIndexerBackend } from "@/parser/indexer/WASMIndexerBackend.ts";
import { WASMStringObjectCSVParser } from "@/parser/models/WASMStringObjectCSVParser.ts";
import { CSVLexerTransformer } from "@/parser/stream/CSVLexerTransformer.ts";
import { CSVRecordAssemblerTransformer } from "@/parser/stream/CSVRecordAssemblerTransformer.ts";
import { StringCSVParserStream } from "@/parser/stream/StringCSVParserStream.ts";
import {
  isInitialized as isWASMInitialized,
  loadWASMSync,
  scanCsvBytesStreaming,
  scanCsvBytesZeroCopy,
} from "@/wasm/WasmInstance.main.web.ts";

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
  // Check if WASM engine is requested
  const engineConfig = new InternalEngineConfig(options?.engine);

  if (engineConfig.hasWasm()) {
    // WASM SIMD path: Use optimized string parser with direct separator detection
    // Ensure WASM is initialized
    if (!isWASMInitialized()) {
      loadWASMSync();
    }

    // Get delimiter character code
    const delimiterCode = (options?.delimiter ?? ",").charCodeAt(0);

    // Create and initialize WASM backend
    const backend = new WASMIndexerBackend(delimiterCode);
    backend.initializeWithModule({
      scanCsvBytesStreaming,
      scanCsvBytesZeroCopy,
      isInitialized: isWASMInitialized,
      loadWASMSync,
    });

    // Create WASM-accelerated parser
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const parserOptions: any = {
      header: options?.header,
      delimiter: options?.delimiter ?? ",",
      quotation: options?.quotation ?? '"',
      columnCountStrategy: options?.columnCountStrategy,
      skipEmptyLines: options?.skipEmptyLines,
      maxFieldCount: options?.maxFieldCount,
      source: options?.source,
    };
    const parser = new WASMStringObjectCSVParser<Header>(parserOptions, backend);

    // Create WASM-accelerated stream transformer
    const parserStream = new StringCSVParserStream<Header, "object">(parser);

    return stream.pipeThrough(
      parserStream as unknown as TransformStream<
        string,
        InferCSVRecord<Header, Options>
      >,
    );
  }

  // JavaScript path
  const lexer = createStringCSVLexer(options);
  const assembler = createCSVRecordAssembler<Header>(options);

  return stream
    .pipeThrough(new CSVLexerTransformer(lexer))
    .pipeThrough(
      new CSVRecordAssemblerTransformer(assembler),
    ) as ReadableStream<InferCSVRecord<Header, Options>>;
}
