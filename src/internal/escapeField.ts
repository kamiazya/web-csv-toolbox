import { COMMA, DOUBLE_QUATE } from "../common/constants.js";
import { CommonOptions } from "../common/types.js";
import { type assertCommonOptions } from "./assertCommonOptions.js";

export interface EscapeFieldOptions extends CommonOptions {
  quate?: true;
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
  // TODO: Cache
  const contents = value.replaceAll(
    quotation,
    quotation
      .replaceAll("$", "$$$$") // $ -> $$ (escape for replaceAll pattern maatching syntax)
      .repeat(2),
  );
  if (
    quate ||
    contents.includes(quotation) ||
    contents.includes(demiliter) ||
    contents.includes("\n") ||
    contents.includes("\r")
  ) {
    return quotation + contents + quotation;
  }
  return contents;
}
