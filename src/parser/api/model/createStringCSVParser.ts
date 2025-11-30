import type {
  CSVProcessingOptions,
  FactoryEngineOptions,
  StringArrayCSVParser,
  StringObjectCSVParser,
} from "@/core/types.ts";
import { WASMIndexerBackend } from "@/parser/indexer/WASMIndexerBackend.ts";
import { FlexibleStringArrayCSVParser } from "@/parser/models/FlexibleStringArrayCSVParser.ts";
import { FlexibleStringObjectCSVParser } from "@/parser/models/FlexibleStringObjectCSVParser.ts";
import { WASMStringArrayCSVParser } from "@/parser/models/WASMStringArrayCSVParser.ts";
import { WASMStringObjectCSVParser } from "@/parser/models/WASMStringObjectCSVParser.ts";
import {
  isInitialized as isWASMInitialized,
  loadWASMSync,
  scanCsvBytesStreaming,
  scanCsvBytesZeroCopy,
} from "@/wasm/WasmInstance.main.web.ts";

/**
 * Factory function to create the appropriate String CSV parser based on options.
 *
 * @template Header - The type of the header row
 * @template Options - CSVProcessingOptions type (inferred from arguments)
 * @param options - CSV processing specification including optional engine configuration
 * @returns A parser instance configured for the specified output format
 *
 * @remarks
 * The return type is determined by the outputFormat option:
 * - `outputFormat: 'object'` (default) → StringObjectCSVParser
 * - `outputFormat: 'array'` → StringArrayCSVParser
 *
 * @example Default usage
 * ```ts
 * const parser = createStringCSVParser({
 *   header: ['name', 'age'] as const,
 * });
 * for (const record of parser.parse('Alice,30\nBob,25')) {
 *   console.log(record); // { name: 'Alice', age: '30' }
 * }
 * ```
 *
 * @example Array format
 * ```ts
 * const parser = createStringCSVParser({
 *   header: ['name', 'age'] as const,
 *   outputFormat: 'array',
 * });
 * for (const record of parser.parse('Alice,30\nBob,25')) {
 *   console.log(record); // ['Alice', '30']
 * }
 * ```
 */
export function createStringCSVParser<
  Header extends ReadonlyArray<string> = readonly string[],
>(
  options: Omit<CSVProcessingOptions<Header>, "outputFormat"> &
    FactoryEngineOptions & {
      outputFormat: "array";
    },
): StringArrayCSVParser<Header>;

export function createStringCSVParser<
  Header extends ReadonlyArray<string> = readonly string[],
>(
  options: Omit<CSVProcessingOptions<Header>, "outputFormat"> &
    FactoryEngineOptions & {
      outputFormat: "object";
    },
): StringObjectCSVParser<Header>;

export function createStringCSVParser<
  Header extends ReadonlyArray<string> = readonly string[],
>(
  options: Omit<CSVProcessingOptions<Header>, "outputFormat"> &
    FactoryEngineOptions & {
      outputFormat: "object" | "array";
    },
): StringArrayCSVParser<Header> | StringObjectCSVParser<Header>;

export function createStringCSVParser<
  Header extends ReadonlyArray<string> = readonly string[],
>(
  options?: CSVProcessingOptions<Header> & FactoryEngineOptions,
): StringObjectCSVParser<Header>;

export function createStringCSVParser<
  Header extends ReadonlyArray<string> = readonly string[],
>(
  options?: CSVProcessingOptions<Header> & FactoryEngineOptions,
): StringArrayCSVParser<Header> | StringObjectCSVParser<Header> {
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
      return new WASMStringArrayCSVParser<Header>(
        options ?? {},
        backend,
      ) as any;
    } else {
      return new WASMStringObjectCSVParser<Header>(
        options ?? {},
        backend,
      ) as any;
    }
  }

  // JavaScript implementation
  if (format === "array") {
    return new FlexibleStringArrayCSVParser<Header>(options ?? {}) as any;
  } else {
    return new FlexibleStringObjectCSVParser<Header>(options ?? {}) as any;
  }
}
