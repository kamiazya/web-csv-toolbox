/**
 * Direct Record Assembler Utilities
 *
 * High-performance utility functions for directly converting WASM separator
 * indices to CSV records without intermediate Token objects.
 *
 * This module provides ~5x performance improvement over Token-based approach
 * by eliminating object allocation overhead.
 *
 * @example
 * ```ts
 * import { separatorsToObjectRecords, createAssemblerState } from './directRecordAssembler';
 *
 * const state = createAssemblerState({ header: ['name', 'age'] });
 * const generator = separatorsToObjectRecords(
 *   separators, sepCount, csvString, config, state
 * );
 *
 * for (const record of generator) {
 *   console.log(record); // { name: 'Alice', age: '30' }
 * }
 * ```
 */

import { ParseError } from "@/core/errors.ts";
import type { ColumnCountStrategy, CSVRecord } from "@/core/types.ts";

/**
 * Configuration for direct record assembly
 */
export interface DirectAssemblerConfig<
  Header extends ReadonlyArray<string> = readonly string[],
> {
  /** Explicit header (undefined = infer from first row) */
  header?: Header;

  /** Quotation character (default: '"') */
  quotation?: string;

  /** Column count strategy (default: 'pad' for object, 'keep' for array) */
  columnCountStrategy?: ColumnCountStrategy;

  /** Skip empty lines (default: false) */
  skipEmptyLines?: boolean;

  /** Include header as first record - array format only (default: false) */
  includeHeader?: boolean;

  /** Maximum field count (default: 100000) */
  maxFieldCount?: number;

  /** Source identifier for error messages */
  source?: string;
}

/**
 * Mutable state for streaming across chunks
 */
export interface DirectAssemblerState {
  /** Collected headers (from first row or explicit) */
  headers: string[];

  /** Whether still processing header row */
  isHeaderRow: boolean;

  /** Current row number (1-based) */
  rowNumber: number;

  /** Whether header has been included in output (array format) */
  headerIncluded: boolean;

  /** Current field start offset within chunk */
  fieldStart: number;

  /** Fields buffer for current row */
  currentRow: string[];

  /** Current column index */
  col: number;
}

/**
 * Create initial assembler state
 */
export function createAssemblerState<
  Header extends ReadonlyArray<string> = readonly string[],
>(config: DirectAssemblerConfig<Header>): DirectAssemblerState {
  const hasExplicitHeader = config.header !== undefined && config.header.length > 0;

  return {
    headers: hasExplicitHeader ? [...config.header!] : [],
    isHeaderRow: !hasExplicitHeader,
    rowNumber: 1,
    headerIncluded: false,
    fieldStart: 0,
    currentRow: [],
    col: 0,
  };
}

/**
 * Unescape a field value directly from string range.
 *
 * Optimized with three-tier approach:
 * 1. Fast path: unquoted field → direct slice
 * 2. Medium path: quoted without escapes → slice without quotes
 * 3. Slow path: quoted with escaped quotes → build unescaped string
 *
 * @param csv - Full CSV string
 * @param start - Start offset (inclusive)
 * @param end - End offset (exclusive)
 * @param quotation - Quote character (default: '"')
 * @returns Unescaped field value
 */
export function unescapeRange(
  csv: string,
  start: number,
  end: number,
  quotation = '"',
): string {
  // Handle empty range
  if (start >= end) return "";

  // Handle CR at end (CRLF line endings)
  if (csv.charCodeAt(end - 1) === 13) end--;
  if (start >= end) return "";

  const quoteCode = quotation.charCodeAt(0);

  // Fast path 1: Not quoted
  if (csv.charCodeAt(start) !== quoteCode) {
    return csv.slice(start, end);
  }

  // Remove surrounding quotes
  start++;
  end--;
  if (start >= end) return "";

  // Fast path 2: Quoted but no escaped quotes
  let hasEscapedQuote = false;
  for (let i = start; i < end; i++) {
    if (csv.charCodeAt(i) === quoteCode) {
      hasEscapedQuote = true;
      break;
    }
  }
  if (!hasEscapedQuote) {
    return csv.slice(start, end);
  }

  // Slow path: Unescape doubled quotes
  let result = "";
  let chunkStart = start;
  for (let i = start; i < end; i++) {
    if (
      csv.charCodeAt(i) === quoteCode &&
      i + 1 < end &&
      csv.charCodeAt(i + 1) === quoteCode
    ) {
      result += csv.slice(chunkStart, i + 1);
      i++; // Skip second quote
      chunkStart = i + 1;
    }
  }
  return result + csv.slice(chunkStart, end);
}

/**
 * Unescape a field value using Extended Scan metadata.
 *
 * Optimized version that uses WASM-provided quote metadata to skip checks:
 * 1. Fast path: isQuoted=false → direct slice (no charCodeAt check!)
 * 2. Medium path: isQuoted=true, needsUnescape=false → slice without quotes
 * 3. Slow path: isQuoted=true, needsUnescape=true → build unescaped string
 *
 * @param csv - Full CSV string
 * @param start - Start offset (inclusive)
 * @param end - End offset (exclusive)
 * @param isQuoted - Whether the field is quoted (from bit 30 of packed separator)
 * @param needsUnescape - Whether the field contains escaped quotes (from unescapeFlags bitmap)
 * @param quotation - Quote character (default: '"')
 * @returns Unescaped field value
 */
export function unescapeRangeExtended(
  csv: string,
  start: number,
  end: number,
  isQuoted: boolean,
  needsUnescape: boolean,
  quotation = '"',
): string {
  // Handle empty range
  if (start >= end) return "";

  // Handle CR at end (CRLF line endings)
  if (csv.charCodeAt(end - 1) === 13) end--;
  if (start >= end) return "";

  // Fast path 1: Not quoted (WASM already determined this!)
  if (!isQuoted) {
    return csv.slice(start, end);
  }

  // Remove surrounding quotes
  start++;
  end--;
  if (start >= end) return "";

  // Fast path 2: Quoted but no escaped quotes (WASM already determined this!)
  if (!needsUnescape) {
    return csv.slice(start, end);
  }

  // Slow path: Unescape doubled quotes
  const quoteCode = quotation.charCodeAt(0);
  let result = "";
  let chunkStart = start;
  for (let i = start; i < end; i++) {
    if (
      csv.charCodeAt(i) === quoteCode &&
      i + 1 < end &&
      csv.charCodeAt(i + 1) === quoteCode
    ) {
      result += csv.slice(chunkStart, i + 1);
      i++; // Skip second quote
      chunkStart = i + 1;
    }
  }
  return result + csv.slice(chunkStart, end);
}

/**
 * Generator: Convert separators directly to object records.
 *
 * Optimized version using direct field assignment (no intermediate arrays).
 * Supports both standard format and extended format (with quote metadata).
 *
 * @param separators - Packed separator indices from WASM
 * @param sepCount - Number of valid separators
 * @param csvString - Decoded CSV string
 * @param config - Assembly configuration
 * @param state - Mutable streaming state (modified in place)
 * @param unescapeFlags - Optional bitmap for extended format (1 bit per field)
 * @yields Object records
 */
export function* separatorsToObjectRecords<
  Header extends ReadonlyArray<string> = readonly string[],
>(
  separators: Uint32Array,
  sepCount: number,
  csvString: string,
  config: DirectAssemblerConfig<Header>,
  state: DirectAssemblerState,
  unescapeFlags?: Uint32Array,
): Generator<CSVRecord<Header, "object">, void, void> {
  const quotation = config.quotation ?? '"';
  const strategy = config.columnCountStrategy ?? "pad";
  const skipEmptyLines = config.skipEmptyLines ?? false;
  const maxFieldCount = config.maxFieldCount ?? 100000;

  // Use extended format if unescapeFlags is provided
  const useExtended = unescapeFlags !== undefined && unescapeFlags.length > 0;

  let fieldStart = 0;
  let record: Record<string, string> | null = null;
  let col = state.col;

  for (let i = 0; i < sepCount; i++) {
    const packed = separators[i]!;

    // Extract offset and sepType based on format
    // Extended format: bits 0-29=offset, bit 30=isQuoted, bit 31=sepType
    // Standard format: bits 0-30=offset, bit 31=sepType
    const offset = useExtended ? (packed & 0x3fffffff) : (packed & 0x7fffffff);
    const isQuoted = useExtended ? ((packed & 0x40000000) !== 0) : false;
    const sepType = packed >>> 31;

    // Get field value using appropriate unescape method
    let field: string;
    if (useExtended) {
      // Extended format: use WASM-provided quote metadata
      const flagWord = unescapeFlags[i >> 5] ?? 0;
      const needsUnescape = (flagWord & (1 << (i & 31))) !== 0;
      field = unescapeRangeExtended(csvString, fieldStart, offset, isQuoted, needsUnescape, quotation);
    } else {
      // Standard format: check first char for quote
      field = unescapeRange(csvString, fieldStart, offset, quotation);
    }

    if (state.isHeaderRow) {
      // Collecting header
      state.headers.push(field);
      if (state.headers.length > maxFieldCount) {
        throw new RangeError(
          `Header field count (${state.headers.length}) exceeded maximum allowed count of ${maxFieldCount}` +
            (config.source ? ` in ${JSON.stringify(config.source)}` : ""),
        );
      }
    } else {
      // Direct assignment to record object (fast path)
      const headerKey = state.headers[col];
      if (headerKey !== undefined) {
        if (record === null) {
          record = Object.create(null) as Record<string, string>;
        }
        record[headerKey] = field;
      }
      col++;
      if (col > maxFieldCount) {
        throw new RangeError(
          `Field count (${col}) exceeded maximum allowed count of ${maxFieldCount}` +
            ` at row ${state.rowNumber}` +
            (config.source ? ` in ${JSON.stringify(config.source)}` : ""),
        );
      }
    }

    fieldStart = offset + 1;

    // Row boundary (LF)
    if (sepType === 1) {
      if (state.isHeaderRow) {
        // Validate header
        if (state.headers.length === 0) {
          throw new ParseError(
            "Headerless mode (header: []) is not supported for object format. " +
              "Use array format (outputFormat: 'array') for headerless CSV, " +
              "or provide a non-empty header for object format.",
            { source: config.source },
          );
        }
        if (new Set(state.headers).size !== state.headers.length) {
          throw new ParseError("The header must not contain duplicate fields.", {
            source: config.source,
          });
        }
        state.isHeaderRow = false;
      } else if (record !== null) {
        // Check for empty line (single empty field)
        const isEmptyLine = col === 1 && record[state.headers[0]!] === "";
        if (isEmptyLine && skipEmptyLines) {
          // Skip empty line
        } else {
          // Finalize record (pad missing fields if needed)
          if (col < state.headers.length) {
            finalizeObjectRecord(
              record,
              state.headers,
              col,
              strategy,
              state.rowNumber,
              config.source,
            );
          } else if (strategy === "strict" && col !== state.headers.length) {
            throw new ParseError(
              `Expected ${state.headers.length} columns, got ${col} at row ${state.rowNumber}` +
                (config.source ? ` in ${JSON.stringify(config.source)}` : ""),
              { source: config.source },
            );
          }
          yield record as CSVRecord<Header, "object">;
        }
        state.rowNumber++;
      }
      record = null;
      col = 0;
    }
  }

  // Save column position for streaming
  state.col = col;

  // Handle trailing field (after last separator but before end of data)
  if (fieldStart < csvString.length) {
    const field = unescapeRange(csvString, fieldStart, csvString.length, quotation);

    if (state.isHeaderRow) {
      state.headers.push(field);
    } else {
      // Store in currentRow for flush handling
      state.currentRow.push(field);
    }
  }

  // Note: Final record without trailing LF is handled in flush
}

/**
 * Flush remaining data as final object record.
 */
export function* flushObjectRecord<
  Header extends ReadonlyArray<string> = readonly string[],
>(
  config: DirectAssemblerConfig<Header>,
  state: DirectAssemblerState,
): Generator<CSVRecord<Header, "object">, void, void> {
  if (state.isHeaderRow) {
    // Still in header row - validate
    if (state.headers.length > 0) {
      if (new Set(state.headers).size !== state.headers.length) {
        throw new ParseError("The header must not contain duplicate fields.", {
          source: config.source,
        });
      }
    }
    return;
  }

  if (state.currentRow.length > 0) {
    const strategy = config.columnCountStrategy ?? "pad";
    const skipEmptyLines = config.skipEmptyLines ?? false;

    // Build record from currentRow using direct assignment
    const headerLength = state.headers.length;
    const rowLength = state.currentRow.length;

    // Check for empty line
    const isEmptyLine = rowLength === 1 && state.currentRow[0] === "";
    if (isEmptyLine && skipEmptyLines) {
      state.currentRow = [];
      return;
    }

    // Build record directly
    const record: Record<string, string | undefined> = Object.create(null);
    const effectiveLength = strategy === "truncate"
      ? Math.min(rowLength, headerLength)
      : Math.min(rowLength, headerLength);

    for (let i = 0; i < effectiveLength; i++) {
      const headerKey = state.headers[i];
      if (headerKey !== undefined) {
        record[headerKey] = state.currentRow[i];
      }
    }

    // Handle column count strategy
    if (strategy === "strict" && rowLength !== headerLength) {
      throw new ParseError(
        `Expected ${headerLength} columns, got ${rowLength} at row ${state.rowNumber}` +
          (config.source ? ` in ${JSON.stringify(config.source)}` : ""),
        { source: config.source },
      );
    }

    // Pad missing fields with undefined
    if (strategy === "pad" && rowLength < headerLength) {
      for (let i = rowLength; i < headerLength; i++) {
        const headerKey = state.headers[i];
        if (headerKey !== undefined) {
          record[headerKey] = undefined;
        }
      }
    }

    yield record as CSVRecord<Header, "object">;
    state.currentRow = [];
  }
}

/**
 * Finalize object record with strategy-based padding.
 *
 * Only called when record has fewer fields than headers and strategy requires action.
 */
function finalizeObjectRecord(
  record: Record<string, string>,
  headers: string[],
  col: number,
  strategy: ColumnCountStrategy,
  rowNumber: number,
  source: string | undefined,
): Record<string, string | undefined> | null {
  const headerLength = headers.length;

  if (strategy === "strict" && col !== headerLength) {
    throw new ParseError(
      `Expected ${headerLength} columns, got ${col} at row ${rowNumber}` +
        (source ? ` in ${JSON.stringify(source)}` : ""),
      { source },
    );
  }

  // Pad missing fields with undefined (for "pad" strategy)
  if (strategy === "pad" && col < headerLength) {
    for (let j = col; j < headerLength; j++) {
      const h = headers[j];
      if (h) record[h] = undefined as unknown as string;
    }
  }

  return record;
}

/**
 * Generator: Convert separators directly to array records.
 *
 * Supports both standard format and extended format (with quote metadata).
 *
 * @param separators - Packed separator indices from WASM
 * @param sepCount - Number of valid separators
 * @param csvString - Decoded CSV string
 * @param config - Assembly configuration
 * @param state - Mutable streaming state (modified in place)
 * @param unescapeFlags - Optional bitmap for extended format (1 bit per field)
 * @yields Array records
 */
export function* separatorsToArrayRecords<
  Header extends ReadonlyArray<string> = readonly string[],
>(
  separators: Uint32Array,
  sepCount: number,
  csvString: string,
  config: DirectAssemblerConfig<Header>,
  state: DirectAssemblerState,
  unescapeFlags?: Uint32Array,
): Generator<CSVRecord<Header, "array">, void, void> {
  const quotation = config.quotation ?? '"';
  const strategy = config.columnCountStrategy ?? "keep";
  const skipEmptyLines = config.skipEmptyLines ?? false;
  const includeHeader = config.includeHeader ?? false;
  const maxFieldCount = config.maxFieldCount ?? 100000;

  // Use extended format if unescapeFlags is provided
  const useExtended = unescapeFlags !== undefined && unescapeFlags.length > 0;

  // Yield header if requested and explicit header provided (before processing)
  if (includeHeader && !state.headerIncluded && state.headers.length > 0 && !state.isHeaderRow) {
    yield [...state.headers] as unknown as CSVRecord<Header, "array">;
    state.headerIncluded = true;
  }

  let fieldStart = 0;

  for (let i = 0; i < sepCount; i++) {
    const packed = separators[i]!;

    // Extract offset and sepType based on format
    // Extended format: bits 0-29=offset, bit 30=isQuoted, bit 31=sepType
    // Standard format: bits 0-30=offset, bit 31=sepType
    const offset = useExtended ? (packed & 0x3fffffff) : (packed & 0x7fffffff);
    const isQuoted = useExtended ? ((packed & 0x40000000) !== 0) : false;
    const sepType = packed >>> 31;

    // Get field value using appropriate unescape method
    let field: string;
    if (useExtended) {
      // Extended format: use WASM-provided quote metadata
      const flagWord = unescapeFlags[i >> 5] ?? 0;
      const needsUnescape = (flagWord & (1 << (i & 31))) !== 0;
      field = unescapeRangeExtended(csvString, fieldStart, offset, isQuoted, needsUnescape, quotation);
    } else {
      // Standard format: check first char for quote
      field = unescapeRange(csvString, fieldStart, offset, quotation);
    }

    if (state.isHeaderRow) {
      // Collecting header
      state.headers.push(field);
      if (state.headers.length > maxFieldCount) {
        throw new RangeError(
          `Header field count (${state.headers.length}) exceeded maximum allowed count of ${maxFieldCount}` +
            (config.source ? ` in ${JSON.stringify(config.source)}` : ""),
        );
      }
    } else {
      // Collecting data field
      state.currentRow.push(field);
      if (state.currentRow.length > maxFieldCount) {
        throw new RangeError(
          `Field count (${state.currentRow.length}) exceeded maximum allowed count of ${maxFieldCount}` +
            ` at row ${state.rowNumber}` +
            (config.source ? ` in ${JSON.stringify(config.source)}` : ""),
        );
      }
    }

    fieldStart = offset + 1;

    // Row boundary (LF)
    if (sepType === 1) {
      if (state.isHeaderRow) {
        state.isHeaderRow = false;
        // Yield header if requested
        if (includeHeader && !state.headerIncluded) {
          yield [...state.headers] as unknown as CSVRecord<Header, "array">;
          state.headerIncluded = true;
        }
      } else {
        // Yield record
        const record = assembleArrayRecord(
          state.headers,
          state.currentRow,
          strategy,
          state.rowNumber,
          config.source,
          skipEmptyLines,
        );
        if (record !== null) {
          yield record as unknown as CSVRecord<Header, "array">;
        }
        state.rowNumber++;
      }
      state.currentRow = [];
    }
  }

  // Handle trailing field
  if (fieldStart < csvString.length) {
    const field = unescapeRange(csvString, fieldStart, csvString.length, quotation);

    if (state.isHeaderRow) {
      state.headers.push(field);
    } else {
      state.currentRow.push(field);
    }
  }
}

/**
 * Flush remaining data as final array record.
 */
export function* flushArrayRecord<
  Header extends ReadonlyArray<string> = readonly string[],
>(
  config: DirectAssemblerConfig<Header>,
  state: DirectAssemblerState,
): Generator<CSVRecord<Header, "array">, void, void> {
  const includeHeader = config.includeHeader ?? false;

  // Yield header if not yet included
  if (includeHeader && !state.headerIncluded && state.headers.length > 0) {
    yield [...state.headers] as unknown as CSVRecord<Header, "array">;
    state.headerIncluded = true;
  }

  if (state.isHeaderRow) {
    // Still in header row - nothing to flush for data
    return;
  }

  if (state.currentRow.length > 0) {
    const strategy = config.columnCountStrategy ?? "keep";
    const skipEmptyLines = config.skipEmptyLines ?? false;

    const record = assembleArrayRecord(
      state.headers,
      state.currentRow,
      strategy,
      state.rowNumber,
      config.source,
      skipEmptyLines,
    );
    if (record !== null) {
      yield record as unknown as CSVRecord<Header, "array">;
    }
    state.currentRow = [];
  }
}

/**
 * Assemble a single array record with strategy application.
 */
function assembleArrayRecord(
  headers: string[],
  row: string[],
  strategy: ColumnCountStrategy,
  rowNumber: number,
  source: string | undefined,
  skipEmptyLines: boolean,
): string[] | null {
  const headerLength = headers.length;
  const rowLength = row.length;

  // Check for empty line
  if (rowLength === 1 && row[0] === "") {
    if (skipEmptyLines) {
      return null;
    }
    // Return empty array or padded array based on strategy
    if (strategy === "pad" && headerLength > 0) {
      return new Array(headerLength).fill("");
    }
    return [""];
  }

  switch (strategy) {
    case "keep":
      // Return as-is (may vary length)
      return [...row];

    case "pad":
      // Pad to header length with undefined, truncate extras
      if (headerLength === 0) {
        return [...row];
      }
      if (rowLength < headerLength) {
        const padded = [...row];
        while (padded.length < headerLength) {
          padded.push("");
        }
        return padded;
      }
      if (rowLength > headerLength) {
        return row.slice(0, headerLength);
      }
      return [...row];

    case "strict":
      // Throw if length doesn't match
      if (headerLength > 0 && rowLength !== headerLength) {
        throw new ParseError(
          `Expected ${headerLength} columns, got ${rowLength} at row ${rowNumber}` +
            (source ? ` in ${JSON.stringify(source)}` : ""),
          { source },
        );
      }
      return [...row];

    case "truncate":
      // Only include fields up to header length
      if (headerLength > 0 && rowLength > headerLength) {
        return row.slice(0, headerLength);
      }
      return [...row];

    default:
      return [...row];
  }
}
