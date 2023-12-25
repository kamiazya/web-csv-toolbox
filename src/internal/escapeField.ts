import { CommonOptions } from "../common/types.js";
import { type assertCommonOptions } from "./assertCommonOptions.js";
import { COMMA, DOUBLE_QUATE } from "./constants.js";

export interface EscapeFieldOptions extends CommonOptions {
  quate?: true;
}

const REPLACED_PATTERN_CACHE = new Map<string, string>();
const CHECK_CACHE = new Map<string, (v: string) => boolean>();

/**
 * Check function for special case of demiliter is repetition of one type of character.
 *
 * Check if the value starts or ends with the demiliter character.
 *
 * @param demiliterChar demiliter character, which is assumed to be a single character.
 * @returns
 */
function specialCheckForDemiliterIsRepetitionOfOneTypeOfCharacter(
  demiliterChar: string,
): (v: string) => boolean {
  return (v: string) =>
    v.startsWith(demiliterChar) || v.endsWith(demiliterChar);
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
    demiliter = COMMA,
    quate,
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
    REPLACED_PATTERN_CACHE.set(replacedPattern, replacedPattern);
  }
  let check: (v: string) => boolean;
  if (CHECK_CACHE.has(demiliter)) {
    // biome-ignore lint/style/noNonNullAssertion: <explanation>
    check = CHECK_CACHE.get(demiliter)!;
  } else {
    const a = new Set([...demiliter]);
    if (demiliter.length > 1 && a.size === 1) {
      const [d] = [...a];
      check = specialCheckForDemiliterIsRepetitionOfOneTypeOfCharacter(d);
    } else {
      check = () => false;
    }
    CHECK_CACHE.set(demiliter, check);
  }

  const contents = value.replaceAll(quotation, replacedPattern);

  if (
    quate ||
    contents.includes(quotation) ||
    contents.includes(demiliter) ||
    contents.includes("\n") ||
    contents.includes("\r") ||
    check(contents)
  ) {
    return quotation + contents + quotation;
  }
  return contents;
}
