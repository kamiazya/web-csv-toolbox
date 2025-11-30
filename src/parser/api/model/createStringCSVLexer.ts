import type { DEFAULT_DELIMITER, DEFAULT_QUOTATION } from "@/core/constants.ts";
import type { StringCSVLexerOptions } from "@/core/types.ts";
import { FlexibleStringCSVLexer } from "@/parser/models/FlexibleStringCSVLexer.ts";

// Re-export the lexer class
export { FlexibleStringCSVLexer } from "@/parser/models/FlexibleStringCSVLexer.ts";

/**
 * Factory function to create a string CSV lexer instance.
 *
 * @param options - Lexer options including delimiter, quotation, abort signal, and engine
 * @returns A FlexibleStringCSVLexer instance configured with the specified options
 *
 * @remarks
 * **Design Intent**: This factory function accepts options including engine configuration
 * to enable future execution path optimization. The function may select the optimal internal
 * lexer implementation based on the provided options. Currently, this optimization
 * is not implemented, but the API is designed to support it without breaking changes.
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
 * ```
 */
export function createStringCSVLexer<
  Delimiter extends string = DEFAULT_DELIMITER,
  Quotation extends string = DEFAULT_QUOTATION,
>(
  options?: StringCSVLexerOptions<Delimiter, Quotation>,
): FlexibleStringCSVLexer<Delimiter, Quotation> {
  return new FlexibleStringCSVLexer<Delimiter, Quotation>(options ?? {});
}
