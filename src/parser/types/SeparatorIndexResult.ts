/**
 * CSV separator indexing result with streaming support
 * Compatible with both WASM and future WebGPU backends
 */
export interface CSVSeparatorIndexResult {
  /**
   * Separator positions (packed format)
   *
   * Standard format: offset | type << 31
   *   - Bits 0-30: byte offset (max 2GB)
   *   - Bit 31: separator type (0=delimiter, 1=LF)
   *
   * Extended format (when unescapeFlags is present): offset | isQuoted << 30 | type << 31
   *   - Bits 0-29: byte offset (max 1GB)
   *   - Bit 30: isQuoted flag (1=field is quoted)
   *   - Bit 31: separator type (0=delimiter, 1=LF)
   */
  readonly separators: Uint32Array;
  /** Number of valid separators */
  readonly sepCount: number;
  /** Bytes processed up to last LF (streaming boundary) */
  readonly processedBytes: number;
  /** Quote state at end: true = inside quote */
  readonly endInQuote: boolean;
  /**
   * Unescape flags bitmap (optional, extended format only)
   *
   * Each bit indicates whether the corresponding field needs unescape processing.
   * Bit N in word M corresponds to field index (M * 32 + N).
   * Set if field contains escaped quotes ("").
   */
  readonly unescapeFlags?: Uint32Array;
}

/** Separator type: delimiter (comma, tab, etc.) */
export const SEP_TYPE_DELIMITER = 0 as const;

/** Separator type: line feed (LF) */
export const SEP_TYPE_LF = 1 as const;

/** Union type for separator types */
export type SeparatorType = typeof SEP_TYPE_DELIMITER | typeof SEP_TYPE_LF;
