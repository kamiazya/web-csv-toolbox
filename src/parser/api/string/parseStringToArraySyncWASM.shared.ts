import {
  DEFAULT_DELIMITER,
  DEFAULT_QUOTATION,
  DOUBLE_QUOTE,
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
  maxBufferSize: number;
  source: string;
}

/**
 * Validates and normalizes options for WASM parsing.
 *
 * @param options - Raw options from user
 * @returns Validated and normalized options
 * @throws {RangeError} If options are invalid
 *
 * @internal
 */
export function validateWASMOptions<
  Delimiter extends string = DEFAULT_DELIMITER,
  Quotation extends string = DEFAULT_QUOTATION,
>(
  options: CommonOptions<Delimiter, Quotation> & {
    header?: readonly string[];
  } = {} as CommonOptions<Delimiter, Quotation>,
): ValidatedWASMOptions {
  const {
    delimiter = DEFAULT_DELIMITER,
    quotation = DEFAULT_QUOTATION,
    maxBufferSize = 10485760,
    source,
  } = options;

  if (typeof delimiter !== "string" || delimiter.length !== 1) {
    throw new RangeError(
      "Invalid delimiter, must be a single character on WASM.",
    );
  }
  if (quotation !== DOUBLE_QUOTE) {
    throw new RangeError("Invalid quotation, must be double quote on WASM.");
  }

  assertCommonOptions({ delimiter, quotation, maxBufferSize });

  return {
    delimiter,
    delimiterCode: delimiter.charCodeAt(0),
    quotation,
    maxBufferSize,
    source: source ?? "",
  };
}

/**
 * Prepares CSV string by prepending custom header if provided.
 *
 * @param csv - Original CSV string
 * @param header - Optional custom header fields
 * @param delimiter - Field delimiter
 * @param quotation - Quotation character
 * @returns CSV string with prepended header if provided, otherwise original CSV
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
      return `${quotation}${field.replace(new RegExp(escapeRegExp(quotation), "g"), quotation + quotation)}${quotation}`;
    }
    return field;
  });

  return `${escapedHeader.join(delimiter)}\n${csv}`;
}

/**
 * Parses CSV string using WASM function and returns parsed result.
 *
 * @param csv - CSV string to parse
 * @param delimiterCode - Character code of delimiter
 * @param maxBufferSize - Maximum buffer size
 * @param source - Source identifier for error messages
 * @param wasmFunction - WASM parsing function
 * @returns Parsed CSV records
 *
 * @internal
 */
export function parseWithWASM<T>(
  csv: string,
  delimiterCode: number,
  maxBufferSize: number,
  source: string,
  wasmFunction: (
    input: string,
    delimiter: number,
    maxBufferSize: number,
    source: string,
  ) => string,
): T {
  return JSON.parse(wasmFunction(csv, delimiterCode, maxBufferSize, source));
}
