import { CR, LF } from "../constants.ts";
import type { CommonOptions } from "../types.ts";

/**
 * Asserts that the provided value is a string and satisfies certain conditions.
 * @param value - The value to be checked.
 * @param name - The name of the option.
 * @throws {RangeError} If the value is empty, longer than 1 byte, or includes CR or LF.
 * @throws {TypeError} If the value is not a string.
 */
function assertOptionValue(
  value: string,
  name: string,
): asserts value is string {
  if (typeof value === "string") {
    switch (true) {
      case value.length === 0:
        throw new RangeError(`${name} must not be empty`);
      case value.length > 1:
        throw new RangeError(`${name} must be a single character`);
      case value === LF:
      case value === CR:
        throw new RangeError(`${name} must not include CR or LF`);
      default:
        break;
    }
  } else {
    throw new TypeError(`${name} must be a string`);
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
 * @throws {RangeError} If any required property is missing or if the delimiter is the same as the quotation.
 * @throws {TypeError} If any required property is not a string.
 */
export function assertCommonOptions<
  Delimiter extends string,
  Quotation extends string,
>(
  options: Required<CommonOptions<Delimiter, Quotation>>,
): asserts options is Required<CommonOptions<Delimiter, Quotation>> {
  for (const name of ["delimiter", "quotation"] as const) {
    assertOptionValue(options[name], name);
  }
  // @ts-ignore: TS doesn't understand that the values are strings
  if (options.delimiter === options.quotation) {
    throw new RangeError(
      "delimiter must not be the same as quotation, use different characters",
    );
  }
}
