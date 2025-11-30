import type { DEFAULT_DELIMITER, DEFAULT_QUOTATION } from "@/core/constants.ts";
import type { InferCSVRecord, ParseBinaryOptions } from "@/core/types.ts";
import { InternalEngineConfig } from "@/engine/config/InternalEngineConfig.ts";
import { createCSVRecordAssembler } from "@/parser/api/model/createCSVRecordAssembler.ts";
import { createStringCSVLexer } from "@/parser/api/model/createStringCSVLexer.ts";
import { WASMIndexerBackend } from "@/parser/indexer/WASMIndexerBackend.ts";
import { WASMBinaryObjectCSVParser } from "@/parser/models/WASMBinaryObjectCSVParser.ts";
import { BinaryCSVParserStream } from "@/parser/stream/BinaryCSVParserStream.ts";
import { CSVRecordAssemblerTransformer } from "@/parser/stream/CSVRecordAssemblerTransformer.ts";
import { StringCSVLexerTransformer } from "@/parser/stream/StringCSVLexerTransformer.ts";
import {
  isInitialized as isWASMInitialized,
  loadWASMSync,
  scanCsvBytesStreaming,
  scanCsvBytesZeroCopy,
} from "@/wasm/WasmInstance.main.web.ts";

export function parseBinaryStreamToStream<
  Header extends readonly string[],
  Delimiter extends string = DEFAULT_DELIMITER,
  Quotation extends string = DEFAULT_QUOTATION,
  Options extends ParseBinaryOptions<
    Header,
    Delimiter,
    Quotation
  > = ParseBinaryOptions<Header, Delimiter, Quotation>,
>(
  stream: ReadableStream<Uint8Array>,
  options?: Options,
): ReadableStream<InferCSVRecord<Header, Options>> {
  const { charset, fatal, ignoreBOM, decompression } = options ?? {};

  // Check if WASM engine is requested
  const engineConfig = new InternalEngineConfig(options?.engine);

  if (engineConfig.hasWasm()) {
    // WASM SIMD path: Use optimized binary parser with direct separator detection
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
    const parser = new WASMBinaryObjectCSVParser<Header>(
      parserOptions,
      backend,
    );

    // Create WASM-accelerated stream transformer
    const parserStream = new BinaryCSVParserStream<Header, "object">(parser);

    // Handle decompression if needed
    if (decompression) {
      return stream
        .pipeThrough(
          new DecompressionStream(decompression) as unknown as TransformStream<
            Uint8Array,
            Uint8Array
          >,
        )
        .pipeThrough(
          parserStream as unknown as TransformStream<
            Uint8Array,
            InferCSVRecord<Header, Options>
          >,
        );
    }

    return stream.pipeThrough(
      parserStream as unknown as TransformStream<
        Uint8Array,
        InferCSVRecord<Header, Options>
      >,
    );
  }

  // JavaScript path
  const decoderOptions: TextDecoderOptions = {};
  if (fatal !== undefined) decoderOptions.fatal = fatal;
  if (ignoreBOM !== undefined) decoderOptions.ignoreBOM = ignoreBOM;

  const lexer = createStringCSVLexer(options);
  const assembler = createCSVRecordAssembler<Header>(options);

  return (
    decompression
      ? stream
          .pipeThrough(
            new DecompressionStream(
              decompression,
            ) as unknown as TransformStream<Uint8Array, Uint8Array>,
          )
          .pipeThrough(
            new TextDecoderStream(
              charset,
              decoderOptions,
            ) as unknown as TransformStream<Uint8Array, string>,
          )
          .pipeThrough(new StringCSVLexerTransformer(lexer))
          .pipeThrough(new CSVRecordAssemblerTransformer(assembler))
      : stream
          .pipeThrough(
            new TextDecoderStream(
              charset,
              decoderOptions,
            ) as unknown as TransformStream<Uint8Array, string>,
          )
          .pipeThrough(new StringCSVLexerTransformer(lexer))
          .pipeThrough(new CSVRecordAssemblerTransformer(assembler))
  ) as ReadableStream<InferCSVRecord<Header, Options>>;
}
