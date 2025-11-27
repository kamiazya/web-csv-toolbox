import type { DEFAULT_DELIMITER, DEFAULT_QUOTATION } from "@/core/constants.ts";
import type {
  AbortSignalOptions,
  CommonOptions,
  FactoryEngineOptions,
} from "@/core/types.ts";
import { FlexibleStringCSVLexer } from "@/parser/models/FlexibleStringCSVLexer.ts";

// Re-export the lexer class
export { FlexibleStringCSVLexer } from "@/parser/models/FlexibleStringCSVLexer.ts";

/**
 * Factory function to create a string CSV lexer instance.
 *
 * @param options - Lexer options including delimiter, quotation, abort signal, and engine config
 * @returns A FlexibleStringCSVLexer instance configured with the specified options
 *
 * @remarks
 * The `engine` option is accepted for API consistency and future extensibility,
 * but currently only the JavaScript implementation is available.
 * WASM lexer is not yet implemented.
 *
 * @example
 * ```ts
 * // Create a lexer with default options
 * const lexer = createStringCSVLexer();
 *
 * // Create a lexer with custom delimiter
 * const tsvLexer = createStringCSVLexer({
 *   delimiter: '\t'
 * });
 *
 * // Create a lexer with abort signal
 * const controller = new AbortController();
 * const lexer = createStringCSVLexer({
 *   signal: controller.signal
 * });
 *
 * // Create a lexer with engine option (accepted but currently uses JS implementation)
 * const lexer = createStringCSVLexer({
 *   engine: { wasm: true } // Accepted for future extensibility
 * });
 * ```
 */
export function createStringCSVLexer<
  Delimiter extends string = DEFAULT_DELIMITER,
  Quotation extends string = DEFAULT_QUOTATION,
>(
  options?: CommonOptions<Delimiter, Quotation> &
    AbortSignalOptions &
    FactoryEngineOptions,
): FlexibleStringCSVLexer<Delimiter, Quotation> {
  // Note: engine option is accepted but currently ignored (no WASM lexer implementation)
  return new FlexibleStringCSVLexer<Delimiter, Quotation>(options ?? {});
}
