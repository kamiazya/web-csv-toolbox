import type { DEFAULT_DELIMITER, DEFAULT_QUOTATION } from "@/core/constants.ts";
import type { InferCSVRecord, ParseBinaryOptions } from "@/core/types.ts";
import { InternalEngineConfig } from "@/engine/config/InternalEngineConfig.ts";
import { createCSVRecordAssembler } from "@/parser/api/model/createCSVRecordAssembler.ts";
import { createStringCSVLexer } from "@/parser/api/model/createStringCSVLexer.ts";
import { CSVLexerTransformer } from "@/parser/stream/CSVLexerTransformer.ts";
import { CSVRecordAssemblerTransformer } from "@/parser/stream/CSVRecordAssemblerTransformer.ts";
import { WASMBinaryCSVStreamTransformer } from "@/parser/stream/WASMBinaryCSVStreamTransformer.ts";

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
  // Check engine configuration for WASM
  const engineConfig = new InternalEngineConfig(options?.engine);

  if (engineConfig.hasWasm()) {
    // Validate charset - WASM only supports UTF-8
    const { charset, decompression } = options ?? {};
    if (charset && charset.toLowerCase() !== "utf-8") {
      throw new Error(
        `Charset '${charset}' is not supported with WASM execution. ` +
          "WASM only supports UTF-8 encoding. " +
          "Use charset: 'utf-8' (default) or disable WASM (engine: { wasm: false }).",
      );
    }

    // WASM path - use WASMBinaryCSVStreamTransformer
    // Create WASM transformer with options
    const transformer = new WASMBinaryCSVStreamTransformer({
      delimiter: options?.delimiter,
      quotation: options?.quotation,
      header: options?.header as readonly string[] | undefined,
      maxFieldCount: options?.maxFieldCount,
      outputFormat: options?.outputFormat,
    });

    if (decompression) {
      return stream
        .pipeThrough(
          new DecompressionStream(decompression) as unknown as TransformStream<
            Uint8Array,
            Uint8Array
          >,
        )
        .pipeThrough(transformer) as ReadableStream<
        InferCSVRecord<Header, Options>
      >;
    }

    return stream.pipeThrough(transformer) as ReadableStream<
      InferCSVRecord<Header, Options>
    >;
  }

  // JavaScript path
  const { charset, fatal, ignoreBOM, decompression } = options ?? {};

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
          .pipeThrough(new CSVLexerTransformer(lexer))
          .pipeThrough(new CSVRecordAssemblerTransformer(assembler))
      : stream
          .pipeThrough(
            new TextDecoderStream(
              charset,
              decoderOptions,
            ) as unknown as TransformStream<Uint8Array, string>,
          )
          .pipeThrough(new CSVLexerTransformer(lexer))
          .pipeThrough(new CSVRecordAssemblerTransformer(assembler))
  ) as ReadableStream<InferCSVRecord<Header, Options>>;
}
