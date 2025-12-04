import type {
  StringArrayCSVParser,
  StringCharset,
  StringCSVParserFactoryOptions,
  StringObjectCSVParser,
} from "@/core/types.ts";
import { WASMIndexerBackend } from "@/parser/indexer/WASMIndexerBackend.ts";
import { FlexibleStringArrayCSVParser } from "@/parser/models/FlexibleStringArrayCSVParser.ts";
import { FlexibleStringObjectCSVParser } from "@/parser/models/FlexibleStringObjectCSVParser.ts";
import { WASMStringArrayCSVParser } from "@/parser/models/WASMStringArrayCSVParser.ts";
import { WASMStringObjectCSVParser } from "@/parser/models/WASMStringObjectCSVParser.ts";
import { WASMStringUtf16ArrayCSVParser } from "@/parser/models/WASMStringUtf16ArrayCSVParser.ts";
import { WASMStringUtf16ObjectCSVParser } from "@/parser/models/WASMStringUtf16ObjectCSVParser.ts";
import {
  isInitialized as isWASMInitialized,
  loadWASMSync,
  scanCsvBytesStreaming,
  scanCsvBytesZeroCopy,
} from "@/wasm/WasmInstance.main.web.ts";

const DEFAULT_STRING_CHARSET: StringCharset = "utf-8";

function prefersUtf16(
  options?: StringCSVParserFactoryOptions,
): boolean {
  return (options?.charset ?? DEFAULT_STRING_CHARSET) === "utf-16";
}

/**
 * Factory function to create the appropriate String CSV parser based on options.
 *
 * @template Header - The type of the header row
 * @param options - Parser options including CSV processing specification and engine
 * @returns A parser instance configured for the specified output format
 *
 * @remarks
 * This function provides both compile-time and runtime type safety.
 * The return type is determined by the outputFormat option:
 * - `outputFormat: 'object'` (default) → StringObjectCSVParser
 * - `outputFormat: 'array'` → StringArrayCSVParser
 *
 * **Design Intent**: This factory function accepts options including engine configuration
 * to enable future execution path optimization. The function may select the optimal internal
 * parser implementation based on the provided options. Currently, this optimization
 * is not implemented, but the API is designed to support it without breaking changes.
 *
 * @example Object format (default)
 * ```ts
 * const parser = createStringCSVParser({
 *   header: ['name', 'age'] as const,
 *   delimiter: ',',
 *   signal: abortController.signal,
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
  options: Omit<StringCSVParserFactoryOptions<Header>, "outputFormat"> & {
    outputFormat: "array";
  },
): StringArrayCSVParser<Header>;

export function createStringCSVParser<
  Header extends ReadonlyArray<string> = readonly string[],
>(
  options: Omit<StringCSVParserFactoryOptions<Header>, "outputFormat"> & {
    outputFormat: "object";
  },
): StringObjectCSVParser<Header>;

export function createStringCSVParser<
  Header extends ReadonlyArray<string> = readonly string[],
>(
  options: Omit<StringCSVParserFactoryOptions<Header>, "outputFormat"> & {
    outputFormat: "object" | "array";
  },
): StringArrayCSVParser<Header> | StringObjectCSVParser<Header>;

export function createStringCSVParser<
  Header extends ReadonlyArray<string> = readonly string[],
>(
  options?: StringCSVParserFactoryOptions<Header>,
): StringObjectCSVParser<Header>;

export function createStringCSVParser<
  Header extends ReadonlyArray<string> = readonly string[],
>(
  options?: StringCSVParserFactoryOptions<Header>,
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
    if (!isWASMInitialized()) {
      loadWASMSync();
    }

    const utf16Preferred = prefersUtf16(options);
    if (utf16Preferred) {
      if (format === "array") {
        return new WASMStringUtf16ArrayCSVParser<Header>(options ?? {}) as any;
      }
      return new WASMStringUtf16ObjectCSVParser<Header>(options ?? {}) as any;
    }

    // UTF-8 WASM implementation using byte indexer
    const delimiterCode = (options?.delimiter ?? ",").charCodeAt(0);
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
    }
    return new WASMStringObjectCSVParser<Header>(options ?? {}, backend) as any;
  }

  // JavaScript implementation
  if (format === "array") {
    return new FlexibleStringArrayCSVParser<Header>(options ?? {}) as any;
  } else {
    return new FlexibleStringObjectCSVParser<Header>(options ?? {}) as any;
  }
}
