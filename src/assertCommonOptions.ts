import type { CommonOptions } from "./common/types.ts";
import { CR, LF } from "./constants.ts";

/**
 * Asserts that the provided value is a string and satisfies certain conditions.
 * @param value - The value to be checked.
 * @param name - The name of the option.
 * @throws {Error} If the value is not a string or does not satisfy the conditions.
 */
function assertOptionValue(
  value: string,
  name: string,
): asserts value is string {
  if (typeof value === "string") {
    switch (true) {
      case value.length === 0:
        throw new Error(`${name} must not be empty`);
      case value.length > 1:
        throw new Error(`${name} must be a single character`);
      case value === LF:
      case value === CR:
        throw new Error(`${name} must not include CR or LF`);
      default:
        break;
    }
  } else {
    throw new Error(`${name} must be a string`);
  }
}

/**
 * Asserts that the provided options object contains all the required properties.
 * Throws an error if any required property is missing
 * or if the delimiter and quotation length is not 1 byte character,
 * or if the delimiter is the same as the quotation.
 *
 * @example
 *
 * ```ts
 * assertCommonOptions({
 *   quotation: '"',
 *   delimiter: ',',
 * });
 * ```
 *
 * @param options - The options object to be validated.
 * @throws {Error} If any required property is missing or if the delimiter is the same as the quotation.
 */
export function assertCommonOptions(
  options: Required<CommonOptions>,
): asserts options is Required<CommonOptions> {
  for (const [name, value] of Object.entries(options)) {
    assertOptionValue(value, name);
  }
  if (options.delimiter === options.quotation) {
    throw new Error(
      "delimiter must not be the same as quotation, use different characters",
    );
  }
}
