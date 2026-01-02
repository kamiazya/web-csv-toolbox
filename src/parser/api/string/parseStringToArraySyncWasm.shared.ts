import type { FlatParseResult } from "web-csv-toolbox-wasm";
import {
  DEFAULT_DELIMITER,
  DEFAULT_QUOTATION,
  DOUBLE_QUOTE,
} from "@/core/constants.ts";
import type { CommonOptions, CSVRecord } from "@/core/types.ts";
import { escapeRegExp } from "@/helpers/string/escapeRegExp.ts";
import { fromFlatParseResult } from "@/parser/utils/flatToObjects.ts";
import { assertCommonOptions } from "@/utils/validation/assertCommonOptions.ts";

/**
 * Validated options for Wasm parsing.
 */
export interface ValidatedWasmOptions {
  delimiter: string;
  delimiterCode: number;
  quotation: string;
  maxBufferSize: number;
  maxFieldCount: number;
  source: string;
}

/**
 * Validates and normalizes options for Wasm parsing.
 *
 * @param options - Raw options from user
 * @returns Validated and normalized options
 * @throws {RangeError} If options are invalid
 *
 * @internal
 */
export function validateWasmOptions<
  Delimiter extends string = DEFAULT_DELIMITER,
  Quotation extends string = DEFAULT_QUOTATION,
>(
  options: CommonOptions<Delimiter, Quotation> & {
    header?: readonly string[];
    maxFieldCount?: number;
  } = {} as CommonOptions<Delimiter, Quotation>,
): ValidatedWasmOptions {
  const {
    delimiter = DEFAULT_DELIMITER,
    quotation = DEFAULT_QUOTATION,
    maxBufferSize = 10485760,
    maxFieldCount = 1000,
    source,
  } = options;

  if (typeof delimiter !== "string" || delimiter.length !== 1) {
    throw new RangeError(
      "Invalid delimiter, must be a single character on Wasm.",
    );
  }
  if (quotation !== DOUBLE_QUOTE) {
    throw new RangeError("Invalid quotation, must be double quote on Wasm.");
  }

  assertCommonOptions({ delimiter, quotation, maxBufferSize });

  return {
    delimiter,
    delimiterCode: delimiter.charCodeAt(0),
    quotation,
    maxBufferSize,
    maxFieldCount,
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
 * Parses CSV string using Wasm function and returns parsed result.
 *
 * Wasm returns FlatParseResult for efficient boundary crossing.
 * Object assembly is done on the JavaScript side using fromFlatParseResult().
 *
 * @param csv - CSV string to parse
 * @param delimiterCode - Character code of delimiter
 * @param maxBufferSize - Maximum buffer size
 * @param maxFieldCount - Maximum number of fields allowed per record
 * @param source - Source identifier for error messages
 * @param wasmFunction - Wasm parsing function that returns FlatParseResult
 * @returns Parsed CSV records
 *
 * @internal
 */
export function parseWithWasm<
  Header extends ReadonlyArray<string> = readonly string[],
>(
  csv: string,
  delimiterCode: number,
  maxBufferSize: number,
  maxFieldCount: number,
  source: string,
  wasmFunction: (
    input: string,
    delimiter: number,
    max_buffer_size: number,
    max_field_count: number,
    source: string,
  ) => FlatParseResult,
): CSVRecord<Header>[] {
  // Wasm returns FlatParseResult for efficient boundary crossing
  const flatResult = wasmFunction(
    csv,
    delimiterCode,
    maxBufferSize,
    maxFieldCount,
    source,
  );

  // Convert flat result to objects using shared utility
  // This uses Object.fromEntries for prototype pollution safety
  return fromFlatParseResult<Header>(flatResult);
}
