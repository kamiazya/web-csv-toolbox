import type {
  ColumnCountStrategy,
  CSVRecordAssemblerFactoryOptions,
} from "@/core/types.ts";
import { FlexibleCSVArrayRecordAssembler } from "@/parser/models/FlexibleCSVArrayRecordAssembler.ts";
import { FlexibleCSVObjectRecordAssembler } from "@/parser/models/FlexibleCSVObjectRecordAssembler.ts";

/**
 * Factory function to create the appropriate CSV record assembler based on options.
 *
 * @param options - Assembler options including outputFormat and engine
 * @returns An assembler instance configured for the specified output format
 *
 * @remarks
 * This function accepts {@link CSVRecordAssemblerFactoryOptions} for flexibility,
 * but runtime validation ensures type safety. For compile-time type safety,
 * use {@link CSVRecordAssemblerOptions} type directly.
 *
 * **Design Intent**: This factory function accepts options including engine configuration
 * to enable future execution path optimization. The function may select the optimal internal
 * assembler implementation based on the provided options. Currently, this optimization
 * is not implemented, but the API is designed to support it without breaking changes.
 *
 * @example
 * ```ts
 * // Create an object record assembler
 * const objectAssembler = createCSVRecordAssembler({
 *   header: ['name', 'age'],
 *   outputFormat: 'object'
 * });
 *
 * // Create an array record assembler
 * const arrayAssembler = createCSVRecordAssembler({
 *   header: ['name', 'age'],
 *   outputFormat: 'array'
 * });
 * ```
 */
// Overload: When outputFormat is explicitly "array"
export function createCSVRecordAssembler<
  const Header extends ReadonlyArray<string>,
  const Strategy extends ColumnCountStrategy = ColumnCountStrategy,
>(
  options: CSVRecordAssemblerFactoryOptions<Header, "array", Strategy> & {
    outputFormat: "array";
  },
): FlexibleCSVArrayRecordAssembler<Header>;

// Overload: When outputFormat is explicitly "object"
export function createCSVRecordAssembler<
  const Header extends ReadonlyArray<string>,
  const Strategy extends ColumnCountStrategy = ColumnCountStrategy,
>(
  options: CSVRecordAssemblerFactoryOptions<Header, "object", Strategy> & {
    outputFormat: "object";
  },
): FlexibleCSVObjectRecordAssembler<Header>;

// Overload: When outputFormat is omitted or undefined (defaults to object)
export function createCSVRecordAssembler<
  const Header extends ReadonlyArray<string>,
  const Strategy extends ColumnCountStrategy = ColumnCountStrategy,
>(
  options?: Omit<
    CSVRecordAssemblerFactoryOptions<Header, "object", Strategy>,
    "outputFormat"
  >,
): FlexibleCSVObjectRecordAssembler<Header>;

// Overload: When outputFormat is a union type (dynamic/runtime determined)
export function createCSVRecordAssembler<
  const Header extends ReadonlyArray<string>,
  const OutputFormat extends "object" | "array" = "object" | "array",
  const Strategy extends ColumnCountStrategy = ColumnCountStrategy,
>(
  options: CSVRecordAssemblerFactoryOptions<Header, OutputFormat, Strategy>,
):
  | FlexibleCSVArrayRecordAssembler<Header>
  | FlexibleCSVObjectRecordAssembler<Header>;

// Implementation signature
export function createCSVRecordAssembler<
  const Header extends ReadonlyArray<string>,
  const OutputFormat extends "object" | "array" = "object" | "array",
  const Strategy extends ColumnCountStrategy = ColumnCountStrategy,
>(
  options?: CSVRecordAssemblerFactoryOptions<Header, OutputFormat, Strategy>,
):
  | FlexibleCSVArrayRecordAssembler<Header>
  | FlexibleCSVObjectRecordAssembler<Header> {
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

  // Validate that 'sparse' strategy is not used with object format
  if (format === "object" && options?.columnCountStrategy) {
    const strategy = options.columnCountStrategy;
    if (strategy === "sparse") {
      throw new Error(
        "columnCountStrategy 'sparse' is not allowed for object format. " +
          "'sparse' fills missing fields with undefined, which is not compatible with object format. " +
          "Use 'fill' (fills with empty string) or outputFormat: 'array' for sparse data.",
      );
    }
    if (strategy === "keep" || strategy === "truncate") {
      throw new Error(
        `columnCountStrategy '${strategy}' is not allowed for object format. ` +
          "Use 'fill' (default) or 'strict' for object output.",
      );
    }
  }

  if (format === "array") {
    return new FlexibleCSVArrayRecordAssembler<Header>(
      (options as any) ?? {},
    ) as any;
  } else {
    return new FlexibleCSVObjectRecordAssembler<Header>(
      (options as any) ?? {},
    ) as any;
  }
}
