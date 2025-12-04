import type { DEFAULT_DELIMITER, DEFAULT_QUOTATION } from "@/core/constants.ts";
import type {
  InferCSVRecord,
  ParseOptions,
  PickCSVHeader,
} from "@/core/types.ts";
import { InternalEngineConfig } from "@/engine/config/InternalEngineConfig.ts";
import { createCSVRecordAssembler } from "@/parser/api/model/createCSVRecordAssembler.ts";
import { createStringCSVLexer } from "@/parser/api/model/createStringCSVLexer.ts";
import { WasmIndexerBackend } from "@/parser/indexer/WasmIndexerBackend.ts";
import { WasmStringUtf16ObjectCSVParser } from "@/parser/models/WasmStringUtf16ObjectCSVParser.ts";
import { WasmStringUtf8ObjectCSVParser } from "@/parser/models/WasmStringUtf8ObjectCSVParser.ts";
import { CSVRecordAssemblerTransformer } from "@/parser/stream/CSVRecordAssemblerTransformer.ts";
import { StringCSVLexerTransformer } from "@/parser/stream/StringCSVLexerTransformer.ts";
import { StringCSVParserStream } from "@/parser/stream/StringCSVParserStream.ts";
import {
  isInitialized as isWasmInitialized,
  loadWasmSync,
  scanCsvBytesStreaming,
  scanCsvBytesZeroCopy,
} from "@/wasm/WasmInstance.main.web.ts";
import { hasWasmSimd } from "@/wasm/loaders/wasmState.ts";

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
  // Check if WASM engine is requested AND SIMD is available
  const engineConfig = new InternalEngineConfig(options?.engine);

  if (engineConfig.hasWasm() && hasWasmSimd()) {
    if (!isWasmInitialized()) {
      loadWasmSync();
    }

    const charset = options?.charset ?? "utf-8";
    const preferUtf16 = charset === "utf-16";

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const parserOptions: any = {
      header: options?.header,
      delimiter: options?.delimiter ?? ",",
      quotation: options?.quotation ?? '"',
      columnCountStrategy: options?.columnCountStrategy,
      skipEmptyLines: options?.skipEmptyLines,
      maxFieldCount: options?.maxFieldCount,
      source: options?.source,
      charset,
    };

    const parser = preferUtf16
      ? new WasmStringUtf16ObjectCSVParser<Header>(parserOptions)
      : createUtf8WasmStringParser(parserOptions);

    // Create Wasm-accelerated stream transformer
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
    .pipeThrough(new StringCSVLexerTransformer(lexer))
    .pipeThrough(
      new CSVRecordAssemblerTransformer(assembler),
    ) as ReadableStream<InferCSVRecord<Header, Options>>;
}

function createUtf8WasmStringParser<Header extends ReadonlyArray<string>>(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  options: any,
) {
  const delimiterCode = (options?.delimiter ?? ",").charCodeAt(0);
  const backend = new WasmIndexerBackend(delimiterCode);
  backend.initializeWithModule({
    scanCsvBytesStreaming,
    scanCsvBytesZeroCopy,
    isInitialized: isWasmInitialized,
    loadWasmSync,
  });
  return new WasmStringUtf8ObjectCSVParser<Header>(options, backend);
}
