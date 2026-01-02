import type { DEFAULT_DELIMITER, DEFAULT_QUOTATION } from "@/core/constants.ts";
import type {
  InferCSVRecord,
  ParseOptions,
  PickCSVHeader,
} from "@/core/types.ts";
import { InternalEngineConfig } from "@/engine/config/InternalEngineConfig.ts";
import { createCSVRecordAssembler } from "@/parser/api/model/createCSVRecordAssembler.ts";
import { createStringCSVLexer } from "@/parser/api/model/createStringCSVLexer.ts";
import { createStringExecutionSelector } from "@/parser/execution/ExecutionStrategySelector.ts";
import { parseStringInGPU } from "@/parser/execution/gpu/parseStringInGPU.ts";
import { commonParseErrorHandling } from "@/utils/error/commonParseErrorHandling.ts";

export function parseStringToStream<
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
): ReadableStream<InferCSVRecord<Header, Options>>;
export function parseStringToStream<
  const CSVSource extends string,
  const Header extends ReadonlyArray<string> = PickCSVHeader<CSVSource>,
  const Options extends ParseOptions<Header> = ParseOptions<Header>,
>(
  stream: CSVSource,
  options?: Options,
): ReadableStream<InferCSVRecord<Header, Options>>;
export function parseStringToStream<
  const Header extends ReadonlyArray<string>,
  const Options extends ParseOptions<Header> = ParseOptions<Header>,
>(
  stream: string,
  options?: Options,
): ReadableStream<InferCSVRecord<Header, Options>>;
export function parseStringToStream<
  const Header extends ReadonlyArray<string>,
  const Options extends ParseOptions<Header> = ParseOptions<Header>,
>(
  csv: string,
  options?: Options,
): ReadableStream<InferCSVRecord<Header, Options>> {
  try {
    // Parse engine configuration
    const engineConfig = new InternalEngineConfig(options?.engine);

    // Check if we need async execution (GPU or WASM)
    if (engineConfig.hasGPU() || engineConfig.hasWasm()) {
      // Create execution selector with GPU and JavaScript executors
      const selector = createStringExecutionSelector<Header, Options>(
        // GPU executor
        (csv, options) => parseStringInGPU(csv, options) as any,
        // JavaScript executor (sync)
        ((csv: string, options: Options | undefined) => {
          const lexer = createStringCSVLexer(options);
          const assembler = createCSVRecordAssembler<Header>(options);
          const tokens = lexer.lex(csv);
          return assembler.assemble(tokens);
        }) as any,
      );

      // Return async ReadableStream
      return new ReadableStream({
        async start(controller) {
          try {
            // Execute with automatic fallback: GPU → WASM → JavaScript
            for await (const record of selector.execute(
              csv,
              options,
              engineConfig,
            ) as AsyncIterableIterator<InferCSVRecord<Header, Options>>) {
              controller.enqueue(record);
            }
            controller.close();
          } catch (error) {
            controller.error(error);
          }
        },
      });
    }

    // Pure JavaScript path (synchronous - no GPU/WASM requested)
    const lexer = createStringCSVLexer(options);
    const assembler = createCSVRecordAssembler<Header>(options);
    return new ReadableStream<InferCSVRecord<Header, Options>>({
      start(controller) {
        const tokens = lexer.lex(csv);
        for (const record of assembler.assemble(tokens)) {
          controller.enqueue(record as InferCSVRecord<Header, Options>);
        }
        controller.close();
      },
    });
  } catch (error) {
    commonParseErrorHandling(error);
  }
}
