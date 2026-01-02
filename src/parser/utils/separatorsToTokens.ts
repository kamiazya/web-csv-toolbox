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

import { Delimiter } from "@/core/constants.ts";
import type { Position, Token, TokenLocation } from "@/core/types.ts";
import {
  SEP_TYPE_DELIMITER,
  SEP_TYPE_LF,
} from "@/parser/types/SeparatorIndexResult.ts";
import { unpackSeparator } from "@/parser/utils/separatorUtils.ts";
import { unescapeQuotes } from "@/parser/utils/unescapeQuotes.ts";

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
   * Generated tokens with location tracking
   */
  tokens: Token<true>[];

  /**
   * State for continuation
   */
  state: SeparatorsToTokensState;
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
    delimiter: _delimiter = ",",
    quotation = '"',
  } = options;

  const tokens: Token<true>[] = [];

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
    const _fieldEndPos: Position = {
      line: fieldEndLine,
      column: fieldEndColumn,
      offset: globalOffset + sepOffset,
    };

    // Create unified field token with delimiter information
    if (sepType === SEP_TYPE_DELIMITER) {
      // Field followed by comma
      const fieldLocation: TokenLocation = {
        start: fieldStartPos,
        end: {
          line: fieldEndLine,
          column: fieldEndColumn + 1,
          offset: globalOffset + sepOffset + 1,
        },
        rowNumber,
      };

      tokens.push({
        value: fieldValue,
        delimiter: Delimiter.Field,
        delimiterLength: 1,
        location: fieldLocation,
      });

      // Update position after comma
      column = fieldEndColumn + 1;
      fieldStart = sepOffset + 1;
    } else if (sepType === SEP_TYPE_LF) {
      // Field followed by newline
      const isCRLF = sepOffset > 0 && data[sepOffset - 1] === 0x0d;
      const delimiterLength = isCRLF ? 2 : 1;

      const fieldLocation: TokenLocation = {
        start: fieldStartPos,
        end: {
          line: fieldEndLine + 1,
          column: 1,
          offset: globalOffset + sepOffset + 1,
        },
        rowNumber,
      };

      tokens.push({
        value: fieldValue,
        delimiter: Delimiter.Record,
        delimiterLength,
        location: fieldLocation,
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

    // Trailing field at EOF - use Record delimiter with length 0
    tokens.push({
      value: fieldValue,
      delimiter: Delimiter.Record,
      delimiterLength: 0,
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
): Generator<Token<true>, SeparatorsToTokensState, void> {
  const {
    rowNumber: initialRowNumber = 1,
    startLine: initialLine = 1,
    startColumn: initialColumn = 1,
    startOffset: initialOffset = 0,
    decoder = new TextDecoder("utf-8"),
    delimiter: _delimiter = ",",
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
    const _fieldEndPos: Position = {
      line: fieldEndLine,
      column: fieldEndColumn,
      offset: globalOffset + sepOffset,
    };

    // Yield unified field token with delimiter information
    if (sepType === SEP_TYPE_DELIMITER) {
      // Field followed by comma
      yield {
        value: fieldValue,
        delimiter: Delimiter.Field,
        delimiterLength: 1,
        location: {
          start: fieldStartPos,
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
      // Field followed by newline
      const isCRLF = sepOffset > 0 && data[sepOffset - 1] === 0x0d;
      const delimiterLength = isCRLF ? 2 : 1;

      yield {
        value: fieldValue,
        delimiter: Delimiter.Record,
        delimiterLength,
        location: {
          start: fieldStartPos,
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

    // Trailing field at EOF - use Record delimiter with length 0
    yield {
      value: fieldValue,
      delimiter: Delimiter.Record,
      delimiterLength: 0,
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
