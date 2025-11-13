import { DEFAULT_DELIMITER, DEFAULT_QUOTATION } from "../../core/constants.ts";
import type { CommonOptions } from "../../core/types.ts";
import { occurrences } from "../../helpers/string/occurrences.ts";
import type { assertCommonOptions } from "../validation/assertCommonOptions.ts";

export interface EscapeFieldOptions<
  Delimiter extends string,
  Quotation extends string,
> extends CommonOptions<Delimiter, Quotation> {
  quote?: true;
}

const REPLACED_PATTERN_CACHE = new Map<string, string>();

/**
 * Escape the field.
 *
 * DO NOT USE THIS FUNCTION BEFORE ASSERTED BY `{@link assertCommonOptions}`.
 * @param value The field value to escape.
 * @param options The options.
 * @returns The escaped field.
 */
export function escapeField<
  const Delimiter extends string,
  const Quotation extends string,
>(
  value: string,
  options: EscapeFieldOptions<Delimiter, Quotation> = {},
): string {
  const {
    delimiter = DEFAULT_DELIMITER,
    quotation = DEFAULT_QUOTATION,
    quote,
  } = options;
  if (!REPLACED_PATTERN_CACHE.has(quotation)) {
    REPLACED_PATTERN_CACHE.set(
      quotation,
      quotation
        .replaceAll("$", "$$$$") // $ -> $$ (escape for replaceAll pattern matching syntax)
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
