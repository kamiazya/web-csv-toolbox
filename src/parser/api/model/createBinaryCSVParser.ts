import type {
  BinaryArrayCSVParser,
  BinaryCSVProcessingOptions,
  BinaryObjectCSVParser,
  FactoryEngineOptions,
} from "@/core/types.ts";
import { WASMIndexerBackend } from "@/parser/indexer/WASMIndexerBackend.ts";
import { FlexibleBinaryArrayCSVParser } from "@/parser/models/FlexibleBinaryArrayCSVParser.ts";
import { FlexibleBinaryObjectCSVParser } from "@/parser/models/FlexibleBinaryObjectCSVParser.ts";
import { WASMBinaryArrayCSVParser } from "@/parser/models/WASMBinaryArrayCSVParser.ts";
import { WASMBinaryObjectCSVParser } from "@/parser/models/WASMBinaryObjectCSVParser.ts";
import {
  isInitialized as isWASMInitialized,
  loadWASMSync,
  scanCsvBytesStreaming,
  scanCsvBytesZeroCopy,
} from "@/wasm/WasmInstance.main.web.ts";

/**
 * Factory function to create the appropriate Binary CSV parser based on options.
 *
 * @template Header - The type of the header row
 * @template Options - BinaryCSVProcessingOptions type (inferred from arguments)
 * @param options - Binary CSV processing specification including optional engine configuration
 * @returns A parser instance configured for the specified output format
 *
 * @remarks
 * The return type is determined by the outputFormat option:
 * - `outputFormat: 'object'` (default) → BinaryObjectCSVParser
 * - `outputFormat: 'array'` → BinaryArrayCSVParser
 *
 * @example Default usage
 * ```ts
 * const parser = createBinaryCSVParser({
 *   header: ['name', 'age'] as const,
 * });
 * const encoder = new TextEncoder();
 * for (const record of parser.parse(encoder.encode('Alice,30\nBob,25'))) {
 *   console.log(record); // { name: 'Alice', age: '30' }
 * }
 * ```
 *
 * @example Array format
 * ```ts
 * const parser = createBinaryCSVParser({
 *   header: ['name', 'age'] as const,
 *   outputFormat: 'array',
 * });
 * const encoder = new TextEncoder();
 * for (const record of parser.parse(encoder.encode('Alice,30\nBob,25'))) {
 *   console.log(record); // ['Alice', '30']
 * }
 * ```
 */
export function createBinaryCSVParser<
  Header extends ReadonlyArray<string> = readonly string[],
>(
  options: Omit<BinaryCSVProcessingOptions<Header>, "outputFormat"> &
    FactoryEngineOptions & {
      outputFormat: "array";
    },
): BinaryArrayCSVParser<Header>;

export function createBinaryCSVParser<
  Header extends ReadonlyArray<string> = readonly string[],
>(
  options: Omit<BinaryCSVProcessingOptions<Header>, "outputFormat"> &
    FactoryEngineOptions & {
      outputFormat: "object";
    },
): BinaryObjectCSVParser<Header>;

export function createBinaryCSVParser<
  Header extends ReadonlyArray<string> = readonly string[],
>(
  options: Omit<BinaryCSVProcessingOptions<Header>, "outputFormat"> &
    FactoryEngineOptions & {
      outputFormat: "object" | "array";
    },
): BinaryArrayCSVParser<Header> | BinaryObjectCSVParser<Header>;

export function createBinaryCSVParser<
  Header extends ReadonlyArray<string> = readonly string[],
>(
  options?: BinaryCSVProcessingOptions<Header> & FactoryEngineOptions,
): BinaryObjectCSVParser<Header>;

export function createBinaryCSVParser<
  Header extends ReadonlyArray<string> = readonly string[],
>(
  options?: BinaryCSVProcessingOptions<Header> & FactoryEngineOptions,
): BinaryArrayCSVParser<Header> | BinaryObjectCSVParser<Header> {
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

  // Check if WASM engine is requested
  const useWASM = options?.engine?.wasm === true;

  if (useWASM) {
    // WASM implementation
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

    if (format === "array") {
      return new WASMBinaryArrayCSVParser<Header>(
        options ?? {},
        backend,
      ) as any;
    } else {
      return new WASMBinaryObjectCSVParser<Header>(
        options ?? {},
        backend,
      ) as any;
    }
  }

  // JavaScript implementation
  if (format === "array") {
    return new FlexibleBinaryArrayCSVParser<Header>(options ?? {}) as any;
  } else {
    return new FlexibleBinaryObjectCSVParser<Header>(options ?? {}) as any;
  }
}
