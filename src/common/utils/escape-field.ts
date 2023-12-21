import { COMMA, CR, DOUBLE_QUATE, LF } from "../constants.js";
import { CommonOptions } from "../types.js";

export interface EscapeFieldOptions extends CommonOptions {
  quate?: true;
}

export function escapeField(
  value: string,
  {
    quotation = DOUBLE_QUATE,
    demiliter = COMMA,
    quate,
  }: EscapeFieldOptions = {},
): string {
  if (typeof quotation === "string" && quotation.length === 0) {
    throw new Error("quotation must not be empty");
  }
  if (typeof demiliter === "string" && demiliter.length === 0) {
    throw new Error("demiliter must not be empty");
  }
  if (quotation.includes(LF) || quotation.includes(CR)) {
    throw new Error("quotation must not include CR or LF");
  }
  if (demiliter.includes(LF) || demiliter.includes(CR)) {
    throw new Error("demiliter must not include CR or LF");
  }
  if (demiliter.includes(quotation) || quotation.includes(demiliter)) {
    throw new Error(
      "demiliter and quotation must not include each other as a substring",
    );
  }

  const contents = value.replaceAll(quotation, quotation.repeat(2));
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
