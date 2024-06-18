import type { assertCommonOptions } from "./assertCommonOptions.ts";
import type { CommonOptions } from "./common/types.ts";
import { COMMA, DOUBLE_QUOTE } from "./constants.ts";
import { occurrences } from "./utils/occurrences.ts";

export interface EscapeFieldOptions extends CommonOptions {
  quote?: true;
}

const REPLACED_PATTERN_CACHE = new Map<string, string>();

/**
 * Escape the field.
 *
 * DO NOT USE THIS FUNCTION BEFORE ASSTPTED BY `{@link assertCommonOptions}`.
 * @param value The field value to escape.
 * @param options The options.
 * @returns The escaped field.
 */
export function escapeField(
  value: string,
  {
    quotation = DOUBLE_QUOTE,
    delimiter = COMMA,
    quote,
  }: EscapeFieldOptions = {},
): string {
  if (!REPLACED_PATTERN_CACHE.has(quotation)) {
    REPLACED_PATTERN_CACHE.set(
      quotation,
      quotation
        .replaceAll("$", "$$$$") // $ -> $$ (escape for replaceAll pattern maatching syntax)
        .repeat(2),
    );
  }
  const replacedPattern = REPLACED_PATTERN_CACHE.get(quotation)!;

  const contents = value.replaceAll(quotation, replacedPattern);

  const wrappedContents = delimiter + contents + delimiter;

  if (
    // If quote is true, it should be quoted.
    quote ||
    // If contents has line breaks, it should be quoted.
    contents.includes("\n") ||
    contents.includes("\r") ||
    // If wrapped contents has more than 3 delimiters,
    // it should be quoted.
    occurrences(wrappedContents, delimiter) >= 3 ||
    // If wrapped contents has more than 1 quotation,
    // it should be quoted.
    occurrences(wrappedContents, quotation) >= 1
  ) {
    return quotation + contents + quotation;
  }
  return contents;
}
