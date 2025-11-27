import type {
  CSVRecordAssemblerCommonOptions,
  FactoryEngineOptions,
} from "@/core/types.ts";
import { FlexibleCSVArrayRecordAssembler } from "@/parser/models/FlexibleCSVArrayRecordAssembler.ts";
import { FlexibleCSVObjectRecordAssembler } from "@/parser/models/FlexibleCSVObjectRecordAssembler.ts";

/**
 * Factory function to create the appropriate CSV record assembler based on options.
 *
 * @param options - Assembler options including outputFormat and engine config
 * @returns An assembler instance configured for the specified output format
 *
 * @remarks
 * This function accepts {@link CSVRecordAssemblerCommonOptions} for flexibility,
 * but runtime validation ensures type safety. For compile-time type safety,
 * use {@link CSVRecordAssemblerOptions} type directly.
 *
 * The `engine` option is accepted for API consistency and future extensibility,
 * but currently only the JavaScript implementation is available.
 * WASM assembler is not yet implemented.
 *
 * @example
 * ```ts
 * // Create an object record assembler
 * const objectAssembler = createCSVRecordAssembler({
 *   header: ['name', 'age'] as const,
 *   outputFormat: 'object'
 * });
 *
 * // Create an array record assembler
 * const arrayAssembler = createCSVRecordAssembler({
 *   header: ['name', 'age'] as const,
 *   outputFormat: 'array'
 * });
 *
 * // Create an assembler with engine option (accepted but currently uses JS implementation)
 * const assembler = createCSVRecordAssembler({
 *   header: ['name', 'age'] as const,
 *   engine: { wasm: true } // Accepted for future extensibility
 * });
 * ```
 */
export function createCSVRecordAssembler<
  Header extends ReadonlyArray<string>,
  Options extends CSVRecordAssemblerCommonOptions<Header> &
    FactoryEngineOptions = CSVRecordAssemblerCommonOptions<Header> &
    FactoryEngineOptions,
>(
  options?: Options,
): Options extends { outputFormat: "array" }
  ? FlexibleCSVArrayRecordAssembler<Header>
  : FlexibleCSVObjectRecordAssembler<Header> {
  // Note: engine option is accepted but currently ignored (no WASM assembler implementation)
  const format = options?.outputFormat ?? "object";

  // Validate headerless mode (header: [])
  const isHeaderless =
    options?.header !== undefined &&
    Array.isArray(options.header) &&
    options.header.length === 0;

  if (isHeaderless) {
    // Headerless mode requires array format
    if (format !== "array") {
      throw new Error(
        `Headerless mode (header: []) is not supported for outputFormat: '${format}'. ` +
          `Use outputFormat: 'array' for headerless CSV, ` +
          `or provide a non-empty header for object format.`,
      );
    }

    // Headerless mode only supports 'keep' strategy
    if (
      options.columnCountStrategy !== undefined &&
      options.columnCountStrategy !== "keep"
    ) {
      throw new Error(
        `Headerless mode (header: []) only supports columnCountStrategy: 'keep'. ` +
          `Got '${options.columnCountStrategy}'. ` +
          `For other strategies, provide a non-empty header.`,
      );
    }
  }

  // Validate that includeHeader is only used with array format
  if (
    options &&
    "includeHeader" in options &&
    options.includeHeader &&
    format !== "array"
  ) {
    throw new Error("includeHeader option is only valid for array format");
  }

  if (format === "array") {
    return new FlexibleCSVArrayRecordAssembler<Header>(options ?? {}) as any;
  } else {
    return new FlexibleCSVObjectRecordAssembler<Header>(options ?? {}) as any;
  }
}
