/**
 * WASM Validation Utilities
 *
 * Shared validation and preparation functions for WASM-based CSV parsing.
 * These utilities ensure consistent validation across string and binary parsers.
 *
 * @internal
 */

import {
  DEFAULT_ASSEMBLER_MAX_FIELD_COUNT,
  DEFAULT_DELIMITER,
  DEFAULT_QUOTATION,
} from "@/core/constants.ts";
import type { CommonOptions } from "@/core/types.ts";
import { escapeRegExp } from "@/helpers/string/escapeRegExp.ts";
import { assertCommonOptions } from "@/utils/validation/assertCommonOptions.ts";

/**
 * Validated options for WASM parsing.
 */
export interface ValidatedWASMOptions {
  delimiter: string;
  delimiterCode: number;
  quotation: string;
  quotationCode: number;
  maxBufferSize: number;
  maxFieldCount: number;
}

/**
 * Validates and normalizes options for WASM parsing.
 *
 * WASM parser has limitations:
 * - Only supports single-character delimiters
 * - Only supports single-character quotation (typically double quote)
 * - Only supports UTF-8 encoding (for binary input)
 *
 * @param options - Raw options from user
 * @returns Validated and normalized options
 * @throws {RangeError} If delimiter or quotation is not a single character
 *
 * @example
 * ```ts
 * const validated = validateWASMOptions({ delimiter: ',', quotation: '"' });
 * // { delimiter: ',', delimiterCode: 44, quotation: '"', quotationCode: 34, ... }
 * ```
 *
 * @internal
 */
export function validateWASMOptions<
  Delimiter extends string = typeof DEFAULT_DELIMITER,
  Quotation extends string = typeof DEFAULT_QUOTATION,
>(
  options: CommonOptions<Delimiter, Quotation> & {
    header?: readonly string[];
    maxFieldCount?: number;
  } = {} as CommonOptions<Delimiter, Quotation>,
): ValidatedWASMOptions {
  const {
    delimiter = DEFAULT_DELIMITER,
    quotation = DEFAULT_QUOTATION,
    maxBufferSize = 10 * 1024 * 1024, // 10MB default
    maxFieldCount = DEFAULT_ASSEMBLER_MAX_FIELD_COUNT,
  } = options;

  // WASM only supports single-character delimiter
  if (typeof delimiter !== "string" || delimiter.length !== 1) {
    throw new RangeError(
      `Delimiter must be a single character for WASM execution. Got: "${delimiter}" (length: ${delimiter.length}). ` +
        `Use the JavaScript parser with engine: { wasm: false } for multi-character delimiters.`,
    );
  }

  // WASM only supports single-character quotation
  if (typeof quotation !== "string" || quotation.length !== 1) {
    throw new RangeError(
      `Quotation must be a single character for WASM execution. Got: "${quotation}" (length: ${quotation.length}). ` +
        `Use the JavaScript parser with engine: { wasm: false } for multi-character quotation.`,
    );
  }

  // Validate common options (maxBufferSize, etc.)
  assertCommonOptions({ delimiter, quotation, maxBufferSize });

  // Validate maxFieldCount
  if (
    typeof maxFieldCount !== "number" ||
    maxFieldCount <= 0 ||
    !Number.isInteger(maxFieldCount)
  ) {
    throw new RangeError("maxFieldCount must be a positive integer");
  }

  return {
    delimiter,
    delimiterCode: delimiter.charCodeAt(0),
    quotation,
    quotationCode: quotation.charCodeAt(0),
    maxBufferSize,
    maxFieldCount,
  };
}

/**
 * Validates charset for WASM binary parsing.
 *
 * WASM parser only supports UTF-8 encoding. If a different charset is specified,
 * this function throws an error with guidance to use the JavaScript parser.
 *
 * @param charset - Charset to validate (undefined means UTF-8)
 * @throws {RangeError} If charset is not UTF-8
 *
 * @example
 * ```ts
 * validateWASMCharset('utf-8'); // OK
 * validateWASMCharset(undefined); // OK (defaults to UTF-8)
 * validateWASMCharset('shift_jis'); // throws RangeError
 * ```
 *
 * @internal
 */
export function validateWASMCharset(charset: string | undefined): void {
  if (charset !== undefined && charset.toLowerCase() !== "utf-8") {
    throw new RangeError(
      `WASM parser only supports UTF-8 encoding. Specified charset: "${charset}". ` +
        `Use the JavaScript parser with engine: { wasm: false } for other encodings.`,
    );
  }
}

/**
 * Prepares CSV string by prepending custom header if provided.
 *
 * When a custom header is provided, this function:
 * 1. Escapes fields containing special characters (delimiter, quotation, newlines)
 * 2. Joins fields with the delimiter
 * 3. Prepends the header row to the CSV
 *
 * @param csv - Original CSV string
 * @param header - Optional custom header fields
 * @param delimiter - Field delimiter
 * @param quotation - Quotation character
 * @returns CSV string with prepended header if provided, otherwise original CSV
 *
 * @example
 * ```ts
 * const csv = 'Alice,30\nBob,25';
 * const result = prepareCSVWithHeader(csv, ['name', 'age'], ',', '"');
 * // 'name,age\nAlice,30\nBob,25'
 * ```
 *
 * @internal
 */
export function prepareCSVWithHeader(
  csv: string,
  header: readonly string[] | undefined,
  delimiter: string,
  quotation: string,
): string {
  if (!header) {
    return csv;
  }

  // Escape fields that contain special characters
  const escapedHeader = header.map((field) => {
    if (
      field.includes(delimiter) ||
      field.includes(quotation) ||
      field.includes("\n") ||
      field.includes("\r")
    ) {
      // Escape quotation characters by doubling them
      const escapedQuotes = field.replace(
        new RegExp(escapeRegExp(quotation), "g"),
        quotation + quotation,
      );
      return `${quotation}${escapedQuotes}${quotation}`;
    }
    return field;
  });

  return `${escapedHeader.join(delimiter)}\n${csv}`;
}
