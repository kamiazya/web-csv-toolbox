/**
 * Convert separator indices to Token stream
 *
 * This module converts packed separator indices from WASM/GPU parsers
 * into the standard Token format used by CSV record assemblers.
 *
 * @example
 * ```ts
 * const tokens = separatorsToTokens(
 *   separators,
 *   sepCount,
 *   data,
 *   { rowNumber: 1 }
 * );
 *
 * for (const token of tokens) {
 *   assembler.assemble(token);
 * }
 * ```
 */

import { Field, FieldDelimiter, RecordDelimiter } from "@/core/constants.ts";
import type { Position, Token, TokenLocation } from "@/core/types.ts";
import { SEP_TYPE_DELIMITER, SEP_TYPE_LF } from "@/parser/types/SeparatorIndexResult.ts";
import { unpackSeparator } from "@/parser/utils/separatorUtils.ts";

/**
 * Options for separatorsToTokens
 */
export interface SeparatorsToTokensOptions {
  /**
   * Starting row number for location tracking.
   * @default 1
   */
  rowNumber?: number;

  /**
   * Starting line number for location tracking.
   * @default 1
   */
  startLine?: number;

  /**
   * Starting column number for location tracking.
   * @default 1
   */
  startColumn?: number;

  /**
   * Starting byte offset for location tracking.
   * @default 0
   */
  startOffset?: number;

  /**
   * Decoder for extracting field values from binary data.
   * @default TextDecoder
   */
  decoder?: TextDecoder;

  /**
   * The field delimiter character used in the CSV.
   * @default ","
   */
  delimiter?: string;

  /**
   * The quotation character used for quoting fields.
   * @default '"'
   */
  quotation?: string;
}

/**
 * State returned from separatorsToTokens for continuation
 */
export interface SeparatorsToTokensState {
  /**
   * Current row number after processing
   */
  rowNumber: number;

  /**
   * Current line number after processing
   */
  line: number;

  /**
   * Current column number after processing
   */
  column: number;

  /**
   * Current byte offset after processing
   */
  offset: number;
}

/**
 * Result of separatorsToTokens
 */
export interface SeparatorsToTokensResult {
  /**
   * Generated tokens
   */
  tokens: Token[];

  /**
   * State for continuation
   */
  state: SeparatorsToTokensState;
}

/**
 * Unescape quotes in a field value.
 *
 * Handles:
 * - Removing surrounding quotes from quoted fields
 * - Converting escaped quotes (doubled quotes) to single quotes
 *
 * @param value - The raw field value
 * @param quotation - The quotation character (default: '"')
 * @returns The unescaped field value
 */
function unescapeQuotes(value: string, quotation = '"'): string {
  if (value.length < 2) {
    return value;
  }

  // Check if the field is quoted
  if (value.startsWith(quotation) && value.endsWith(quotation)) {
    // Remove surrounding quotes and unescape internal quotes
    const escaped = quotation + quotation;
    return value.slice(1, -1).replace(new RegExp(escaped.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), quotation);
  }

  return value;
}

/**
 * Convert packed separator indices to Token array.
 *
 * This function takes the raw separator indices from WASM/GPU parsers
 * and converts them into the standard Token format that can be used
 * with existing CSV record assemblers.
 *
 * @param separators - Packed separator indices (sorted by offset)
 * @param sepCount - Number of valid separators
 * @param data - Raw CSV binary data
 * @param options - Conversion options
 * @returns Tokens and state for continuation
 *
 * @example
 * ```ts
 * const result = separatorsToTokens(
 *   wasmResult.separators,
 *   wasmResult.sepCount,
 *   csvBytes,
 *   { rowNumber: 1 }
 * );
 *
 * // Use tokens with assembler
 * for (const token of result.tokens) {
 *   const record = assembler.assemble(token);
 *   if (record) console.log(record);
 * }
 *
 * // Continue with next chunk using returned state
 * const result2 = separatorsToTokens(
 *   nextSeparators,
 *   nextSepCount,
 *   nextData,
 *   result.state
 * );
 * ```
 */
export function separatorsToTokens(
  separators: Uint32Array,
  sepCount: number,
  data: Uint8Array,
  options: SeparatorsToTokensOptions = {},
): SeparatorsToTokensResult {
  const {
    rowNumber: initialRowNumber = 1,
    startLine: initialLine = 1,
    startColumn: initialColumn = 1,
    startOffset: initialOffset = 0,
    decoder = new TextDecoder("utf-8"),
    delimiter = ",",
    quotation = '"',
  } = options;

  const tokens: Token[] = [];

  let line = initialLine;
  let column = initialColumn;
  const globalOffset = initialOffset;
  let rowNumber = initialRowNumber;

  // Track the start of the current field
  let fieldStart = 0;

  for (let i = 0; i < sepCount; i++) {
    const sep = unpackSeparator(separators[i]!);
    const sepOffset = sep.offset;
    const sepType = sep.type;

    // Extract field value (from fieldStart to separator)
    // For LF separators, check if preceding byte is CR (CRLF) and exclude it
    let fieldEnd = sepOffset;
    if (
      sepType === SEP_TYPE_LF &&
      sepOffset > fieldStart &&
      data[sepOffset - 1] === 0x0d
    ) {
      fieldEnd = sepOffset - 1; // Exclude CR from field
    }
    // Use subarray (zero-copy view) for better performance
    const fieldBytes = data.subarray(fieldStart, fieldEnd);
    const fieldValue = unescapeQuotes(decoder.decode(fieldBytes), quotation);

    // Calculate field token location
    const fieldStartPos: Position = {
      line,
      column,
      offset: globalOffset + fieldStart,
    };

    // Update position for field end
    const fieldEndLine = line;
    const fieldEndColumn = column + (sepOffset - fieldStart);
    const fieldEndPos: Position = {
      line: fieldEndLine,
      column: fieldEndColumn,
      offset: globalOffset + sepOffset,
    };

    // Create field token
    const fieldLocation: TokenLocation = {
      start: fieldStartPos,
      end: fieldEndPos,
      rowNumber,
    };

    tokens.push({
      type: Field,
      value: fieldValue,
      location: fieldLocation,
    });

    // Create delimiter token
    if (sepType === SEP_TYPE_DELIMITER) {
      // Field delimiter (comma)
      const delimLocation: TokenLocation = {
        start: {
          line: fieldEndLine,
          column: fieldEndColumn,
          offset: globalOffset + sepOffset,
        },
        end: {
          line: fieldEndLine,
          column: fieldEndColumn + 1,
          offset: globalOffset + sepOffset + 1,
        },
        rowNumber,
      };

      tokens.push({
        type: FieldDelimiter,
        value: delimiter,
        location: delimLocation,
      });

      // Update position after comma
      column = fieldEndColumn + 1;
      fieldStart = sepOffset + 1;
    } else if (sepType === SEP_TYPE_LF) {
      // Record delimiter (LF)
      // Check if there's a CR before LF (CRLF)
      const isCRLF = sepOffset > 0 && data[sepOffset - 1] === 0x0d;
      const newlineValue = isCRLF ? "\r\n" : "\n";
      const newlineStart = isCRLF ? sepOffset - 1 : sepOffset;

      const delimLocation: TokenLocation = {
        start: {
          line: fieldEndLine,
          column: isCRLF ? fieldEndColumn - 1 : fieldEndColumn,
          offset: globalOffset + newlineStart,
        },
        end: {
          line: fieldEndLine + 1,
          column: 1,
          offset: globalOffset + sepOffset + 1,
        },
        rowNumber,
      };

      tokens.push({
        type: RecordDelimiter,
        value: newlineValue,
        location: delimLocation,
      });

      // Update position after newline
      line++;
      column = 1;
      rowNumber++;
      fieldStart = sepOffset + 1;
    }
  }

  // Handle trailing field if there's data after the last separator
  if (fieldStart < data.length) {
    // Use subarray (zero-copy view) for better performance
    const fieldBytes = data.subarray(fieldStart);
    const fieldValue = unescapeQuotes(decoder.decode(fieldBytes), quotation);

    const fieldStartPos: Position = {
      line,
      column,
      offset: globalOffset + fieldStart,
    };

    const fieldEndPos: Position = {
      line,
      column: column + fieldBytes.length,
      offset: globalOffset + data.length,
    };

    const fieldLocation: TokenLocation = {
      start: fieldStartPos,
      end: fieldEndPos,
      rowNumber,
    };

    tokens.push({
      type: Field,
      value: fieldValue,
      location: fieldLocation,
    });

    column += fieldBytes.length;
  }

  return {
    tokens,
    state: {
      rowNumber,
      line,
      column,
      offset: globalOffset + data.length,
    },
  };
}

/**
 * Generator version of separatorsToTokens for memory-efficient processing.
 *
 * @param separators - Packed separator indices (sorted by offset)
 * @param sepCount - Number of valid separators
 * @param data - Raw CSV binary data
 * @param options - Conversion options
 * @yields Tokens one at a time
 * @returns Final state for continuation
 */
export function* separatorsToTokensGenerator(
  separators: Uint32Array,
  sepCount: number,
  data: Uint8Array,
  options: SeparatorsToTokensOptions = {},
): Generator<Token, SeparatorsToTokensState, void> {
  const {
    rowNumber: initialRowNumber = 1,
    startLine: initialLine = 1,
    startColumn: initialColumn = 1,
    startOffset: initialOffset = 0,
    decoder = new TextDecoder("utf-8"),
    delimiter = ",",
    quotation = '"',
  } = options;

  let line = initialLine;
  let column = initialColumn;
  const globalOffset = initialOffset;
  let rowNumber = initialRowNumber;
  let fieldStart = 0;

  for (let i = 0; i < sepCount; i++) {
    const sep = unpackSeparator(separators[i]!);
    const sepOffset = sep.offset;
    const sepType = sep.type;

    // Extract and yield field token
    // For LF separators, check if preceding byte is CR (CRLF) and exclude it
    let fieldEnd = sepOffset;
    if (
      sepType === SEP_TYPE_LF &&
      sepOffset > fieldStart &&
      data[sepOffset - 1] === 0x0d
    ) {
      fieldEnd = sepOffset - 1; // Exclude CR from field
    }
    // Use subarray (zero-copy view) for better performance
    const fieldBytes = data.subarray(fieldStart, fieldEnd);
    const fieldValue = unescapeQuotes(decoder.decode(fieldBytes), quotation);

    const fieldStartPos: Position = {
      line,
      column,
      offset: globalOffset + fieldStart,
    };

    const fieldEndLine = line;
    const fieldEndColumn = column + (sepOffset - fieldStart);
    const fieldEndPos: Position = {
      line: fieldEndLine,
      column: fieldEndColumn,
      offset: globalOffset + sepOffset,
    };

    yield {
      type: Field,
      value: fieldValue,
      location: {
        start: fieldStartPos,
        end: fieldEndPos,
        rowNumber,
      },
    };

    // Yield delimiter token
    if (sepType === SEP_TYPE_DELIMITER) {
      yield {
        type: FieldDelimiter,
        value: delimiter,
        location: {
          start: {
            line: fieldEndLine,
            column: fieldEndColumn,
            offset: globalOffset + sepOffset,
          },
          end: {
            line: fieldEndLine,
            column: fieldEndColumn + 1,
            offset: globalOffset + sepOffset + 1,
          },
          rowNumber,
        },
      };

      column = fieldEndColumn + 1;
      fieldStart = sepOffset + 1;
    } else if (sepType === SEP_TYPE_LF) {
      const isCRLF = sepOffset > 0 && data[sepOffset - 1] === 0x0d;
      const newlineValue = isCRLF ? "\r\n" : "\n";
      const newlineStart = isCRLF ? sepOffset - 1 : sepOffset;

      yield {
        type: RecordDelimiter,
        value: newlineValue,
        location: {
          start: {
            line: fieldEndLine,
            column: isCRLF ? fieldEndColumn - 1 : fieldEndColumn,
            offset: globalOffset + newlineStart,
          },
          end: {
            line: fieldEndLine + 1,
            column: 1,
            offset: globalOffset + sepOffset + 1,
          },
          rowNumber,
        },
      };

      line++;
      column = 1;
      rowNumber++;
      fieldStart = sepOffset + 1;
    }
  }

  // Handle trailing field
  if (fieldStart < data.length) {
    // Use subarray (zero-copy view) for better performance
    const fieldBytes = data.subarray(fieldStart);
    const fieldValue = unescapeQuotes(decoder.decode(fieldBytes), quotation);

    yield {
      type: Field,
      value: fieldValue,
      location: {
        start: { line, column, offset: globalOffset + fieldStart },
        end: {
          line,
          column: column + fieldBytes.length,
          offset: globalOffset + data.length,
        },
        rowNumber,
      },
    };

    column += fieldBytes.length;
  }

  return {
    rowNumber,
    line,
    column,
    offset: globalOffset + data.length,
  };
}
