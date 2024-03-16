import type { CommonOptions } from "./common/types.ts";
import { CR, LF } from "./constants.ts";

/**
 * Assert that the options are valid.
 *
 * @param options The options to assert.
 */
export function assertCommonOptions(options: Required<CommonOptions>): void {
  if (typeof options.quotation === "string" && options.quotation.length === 0) {
    throw new Error("quotation must not be empty");
  }
  if (typeof options.delimiter === "string" && options.delimiter.length === 0) {
    throw new Error("delimiter must not be empty");
  }
  if (options.quotation.includes(LF) || options.quotation.includes(CR)) {
    throw new Error("quotation must not include CR or LF");
  }
  if (options.delimiter.includes(LF) || options.delimiter.includes(CR)) {
    throw new Error("delimiter must not include CR or LF");
  }
  if (
    options.delimiter.includes(options.quotation) ||
    options.quotation.includes(options.delimiter)
  ) {
    throw new Error(
      "delimiter and quotation must not include each other as a substring",
    );
  }
}
