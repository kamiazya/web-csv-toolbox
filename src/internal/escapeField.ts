import { CommonOptions } from "../common/types.js";
import { type assertCommonOptions } from "./assertCommonOptions.js";
import { COMMA, DOUBLE_QUATE } from "./constants.js";

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
    quotation = DOUBLE_QUATE,
    delimiter = COMMA,
    quote,
  }: EscapeFieldOptions = {},
): string {
  let replacedPattern: string;
  if (REPLACED_PATTERN_CACHE.has(quotation)) {
    // biome-ignore lint/style/noNonNullAssertion: <explanation>
    replacedPattern = REPLACED_PATTERN_CACHE.get(quotation)!;
  } else {
    replacedPattern = quotation
      .replaceAll("$", "$$$$") // $ -> $$ (escape for replaceAll pattern maatching syntax)
      .repeat(2);
    REPLACED_PATTERN_CACHE.set(quotation, replacedPattern);
  }
  let check: (v: string) => boolean;
  if (CHECK_CACHE.has(delimiter)) {
    // biome-ignore lint/style/noNonNullAssertion: <explanation>
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

  if (
    quote ||
    contents.includes(quotation) ||
    contents.includes(delimiter) ||
    contents.includes("\n") ||
    contents.includes("\r") ||
    check(contents)
  ) {
    return quotation + contents + quotation;
  }
  return contents;
}
