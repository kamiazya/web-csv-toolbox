import { CommonOptions } from "../common/types.ts";
import { type assertCommonOptions } from "./assertCommonOptions.ts";
import { COMMA, DOUBLE_QUOTE } from "./constants.ts";
import { escapeRegExp } from "./utils/escapeRegExp.ts";

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
    quotation = DOUBLE_QUOTE,
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
    contents.includes("\n") ||
    contents.includes("\r") ||
    // If wrapped contents has more than 3 delimiters, it should be quoted.
    Array.from(
      (delimiter + contents + delimiter).matchAll(
        new RegExp(`(?=(${escapeRegExp(delimiter)}))`, "g"),
      ),
      ([, v]) => v,
    ).length >= 3 ||
    quotation.at(0) === delimiter.at(-1) ||
    quotation.at(-1) === delimiter.at(0) ||
    check(contents)
  ) {
    return quotation + contents + quotation;
  }
  return contents;
}
