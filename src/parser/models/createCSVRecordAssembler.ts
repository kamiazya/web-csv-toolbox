import type { CSVRecordAssemblerOptions } from "@/core/types.ts";
import { FlexibleCSVArrayRecordAssembler } from "./FlexibleCSVArrayRecordAssembler.ts";
import { FlexibleCSVObjectRecordAssembler } from "./FlexibleCSVObjectRecordAssembler.ts";

// Re-export the specialized assemblers
export { FlexibleCSVArrayRecordAssembler } from "./FlexibleCSVArrayRecordAssembler.ts";
export { FlexibleCSVObjectRecordAssembler } from "./FlexibleCSVObjectRecordAssembler.ts";

/**
 * Factory function to create the appropriate CSV record assembler based on options.
 *
 * @param options - Assembler options including outputFormat
 * @returns An assembler instance configured for the specified output format
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
 * ```
 */
export function createCSVRecordAssembler<
  Header extends ReadonlyArray<string>,
  Options extends
    CSVRecordAssemblerOptions<Header> = CSVRecordAssemblerOptions<Header>,
>(
  options?: Options,
): Options extends { outputFormat: "array" }
  ? FlexibleCSVArrayRecordAssembler<Header>
  : FlexibleCSVObjectRecordAssembler<Header> {
  const format = options?.outputFormat ?? "object";

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
