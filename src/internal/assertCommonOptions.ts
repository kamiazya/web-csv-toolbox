import { CommonOptions } from "../common/types.js";
import { CR, LF } from "./constants.js";

/**
 * Assert that the options are valid.
 *
 * @param options The options to assert.
 */
export function assertCommonOptions(options: Required<CommonOptions>): void {
  if (typeof options.quotation === "string" && options.quotation.length === 0) {
    throw new Error("quotation must not be empty");
  }
  if (typeof options.demiliter === "string" && options.demiliter.length === 0) {
    throw new Error("demiliter must not be empty");
  }
  if (options.quotation.includes(LF) || options.quotation.includes(CR)) {
    throw new Error("quotation must not include CR or LF");
  }
  if (options.demiliter.includes(LF) || options.demiliter.includes(CR)) {
    throw new Error("demiliter must not include CR or LF");
  }
  if (
    options.demiliter.includes(options.quotation) ||
    options.quotation.includes(options.demiliter)
  ) {
    throw new Error(
      "demiliter and quotation must not include each other as a substring",
    );
  }
}
