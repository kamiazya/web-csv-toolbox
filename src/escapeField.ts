import type { assertCommonOptions } from "./assertCommonOptions.ts";
import type { CommonOptions } from "./common/types.ts";
import { DEFAULT_DELIMITER, DEFAULT_QUOTATION } from "./constants.ts";
import { occurrences } from "./utils/occurrences.ts";

export interface EscapeFieldOptions extends CommonOptions {
  quote?: true;
}

const REPLACED_PATTERN_CACHE = new Map<string, string>();
const CHECK_CACHE = new Map<string, (v: string) => boolean>();

/**
 * Check function for special case of delimiter is repetition of one type of character.
 *
 * Check if the value starts or ends with the delimiter character.
 *
 * @param delimiter which is assumed to be a single character.
 */
function specialCheckFordelimiterIsRepetitionOfOneTypeOfCharacter(
  delimiter: string,
): (v: string) => boolean {
  return (v: string) => v.startsWith(delimiter) || v.endsWith(delimiter);
}

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
    delimiter = DEFAULT_DELIMITER,
    quotation = DEFAULT_QUOTATION,
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
  let check: (v: string) => boolean;
  if (CHECK_CACHE.has(delimiter)) {
    check = CHECK_CACHE.get(delimiter)!;
  } else {
    const a = new Set([...delimiter]);
    if (delimiter.length > 1 && a.size === 1) {
      const [d] = [...a];
      check = specialCheckFordelimiterIsRepetitionOfOneTypeOfCharacter(d);
    } else {
      check = () => false;
    }
    CHECK_CACHE.set(delimiter, check);
  }

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
    occurrences(wrappedContents, quotation) >= 1 ||
    check(contents)
  ) {
    return quotation + contents + quotation;
  }
  return contents;
}
