import {
  DEFAULT_DELIMITER,
  DEFAULT_LEXER_MAX_BUFFER_SIZE,
  DEFAULT_QUOTATION,
  Delimiter,
  LF,
} from "@/core/constants.ts";
import { ParseError } from "@/core/errors.ts";
import type {
  AbortSignalOptions,
  CommonOptions,
  CSVLexerLexOptions,
  Position,
  Token,
  TrackLocationOption,
} from "@/core/types.ts";
import { assertCommonOptions } from "@/utils/validation/assertCommonOptions.ts";

/**
 * Flexible String CSV Lexer implementation.
 *
 * An optimized lexer that emits unified field tokens, reducing token count by 50%.
 * Instead of separate Field, FieldDelimiter, and RecordDelimiter tokens,
 * only field tokens are emitted with the `delimiter` property indicating what follows.
 *
 * @remarks
 * This implementation provides better performance by reducing object allocation
 * and simplifying the token stream.
 *
 * @template Delimiter - The field delimiter character (default: ',')
 * @template Quotation - The quotation character (default: '"')
 * @template TrackLocation - Whether to include location in tokens (default: false)
 */
// Character codes for fast comparison
const CR = 13; // '\r'
const LF_CODE = 10; // '\n'

export class FlexibleStringCSVLexer<
  DelimiterType extends string = DEFAULT_DELIMITER,
  Quotation extends string = DEFAULT_QUOTATION,
  TrackLocation extends boolean = false,
> {
  #delimiter: string;
  #quotation: string;
  #buffer = "";
  #bufferOffset = 0;
  #flush = false;
  #fieldDelimiterLength: number;
  #maxBufferSize: number;
  #trackLocation: boolean;

  // Pre-computed character codes for fast comparison
  #delimiterCode: number;
  #quotationCode: number;

  // Track whether we need to emit an empty EOF token after trailing field delimiter
  #pendingTrailingFieldEOF = false;

  // For lazy position tracking in no-location mode (streaming support)
  // Tracks cumulative line number at the start of current buffer
  #baseLineNumber = 1;
  // Tracks column position at the start of current buffer (when truncation is mid-line)
  #baseColumn = 1;

  // Only used when trackLocation is true
  #cursor: Position = {
    line: 1,
    column: 1,
    offset: 0,
  };
  #rowNumber = 1;

  #signal?: AbortSignal | undefined;
  #source?: string | undefined;

  constructor(
    options: CommonOptions<DelimiterType, Quotation> &
      TrackLocationOption<TrackLocation> &
      AbortSignalOptions = {} as CommonOptions<DelimiterType, Quotation> &
      TrackLocationOption<TrackLocation> &
      AbortSignalOptions,
  ) {
    const {
      delimiter = DEFAULT_DELIMITER,
      quotation = DEFAULT_QUOTATION,
      maxBufferSize = DEFAULT_LEXER_MAX_BUFFER_SIZE,
      trackLocation = false as TrackLocation,
      signal,
      source,
    } = options;
    assertCommonOptions({ delimiter, quotation, maxBufferSize });
    this.#delimiter = delimiter;
    this.#quotation = quotation;
    this.#fieldDelimiterLength = delimiter.length;
    this.#maxBufferSize = maxBufferSize;
    this.#trackLocation = trackLocation;
    this.#source = source;
    this.#signal = signal;

    // Pre-compute character codes
    this.#delimiterCode = delimiter.charCodeAt(0);
    this.#quotationCode = quotation.charCodeAt(0);
  }

  // ==================== Common Helper Methods ====================

  /**
   * Computes line and column position by scanning the buffer from start to current offset.
   * Used for lazy position tracking - only called when an error occurs.
   * This is O(n) but errors are rare, so the cost is acceptable.
   */
  #computePositionFromBuffer(): { line: number; column: number } {
    // Start with cumulative line/column from previously truncated buffer portions
    let line = this.#baseLineNumber;
    let column = this.#baseColumn;
    const end = this.#bufferOffset;
    for (let i = 0; i < end; i++) {
      if (this.#buffer.charCodeAt(i) === LF_CODE) {
        line++;
        column = 1;
      } else {
        column++;
      }
    }
    return { line, column };
  }

  /**
   * Throws a ParseError for unexpected EOF while parsing quoted field.
   * Uses lazy position tracking - computes position only when error occurs.
   */
  #throwUnexpectedEOF(): never {
    const pos = this.#computePositionFromBuffer();
    throw new ParseError(
      `Unexpected EOF while parsing quoted field at line ${pos.line}, column ${pos.column}.`,
      {
        position: { ...pos, offset: this.#bufferOffset },
        source: this.#source,
      },
    );
  }

  /**
   * Throws a ParseError for unexpected EOF while parsing quoted field (with location).
   * Used by location-tracking parsing paths.
   */
  #throwUnexpectedEOFWithLocation(): never {
    throw new ParseError("Unexpected EOF while parsing quoted field.", {
      position: { ...this.#cursor },
      rowNumber: this.#rowNumber,
      source: this.#source,
    });
  }

  /**
   * Lexes the given chunk of CSV data.
   * @param chunk - The chunk of CSV data to be lexed. Omit to flush remaining data.
   * @param options - Lexer options.
   * @returns An iterable iterator of tokens.
   */
  public lex(
    chunk?: string,
    options?: CSVLexerLexOptions,
  ): IterableIterator<Token<TrackLocation>> {
    const stream = options?.stream ?? false;

    if (!stream) {
      this.#flush = true;
    }
    if (chunk !== undefined && chunk.length !== 0) {
      // Clear pending trailing flag since we're adding more data
      this.#pendingTrailingFieldEOF = false;
      if (this.#bufferOffset > 0) {
        // Update base position for lazy position tracking before truncating
        // Track both line and column through the truncated portion
        if (!this.#trackLocation) {
          let column = this.#baseColumn;
          for (let i = 0; i < this.#bufferOffset; i++) {
            if (this.#buffer.charCodeAt(i) === LF_CODE) {
              this.#baseLineNumber++;
              column = 1;
            } else {
              column++;
            }
          }
          this.#baseColumn = column;
        }
        this.#buffer = this.#buffer.slice(this.#bufferOffset);
        this.#bufferOffset = 0;
      }
      this.#buffer += chunk;
      this.#checkBufferSize();
    }

    return this.#tokens();
  }

  *#tokens(): Generator<Token<TrackLocation>> {
    let token: Token<TrackLocation> | null;
    while ((token = this.#nextField())) {
      yield token;
    }
  }

  #checkBufferSize(): void {
    if (this.#buffer.length > this.#maxBufferSize) {
      throw new RangeError(
        `Buffer size (${this.#buffer.length} characters) exceeded maximum allowed size of ${this.#maxBufferSize} characters`,
      );
    }
  }

  #nextField(): Token<TrackLocation> | null {
    this.#signal?.throwIfAborted();
    const remainingLen = this.#buffer.length - this.#bufferOffset;
    if (remainingLen === 0) {
      // Emit empty EOF token after trailing field delimiter (e.g., ",x," -> 3 fields)
      if (this.#pendingTrailingFieldEOF && this.#flush) {
        this.#pendingTrailingFieldEOF = false;
        if (this.#trackLocation) {
          return {
            value: "",
            delimiter: Delimiter.EOF,
            delimiterLength: 0,
            location: {
              start: { ...this.#cursor },
              end: { ...this.#cursor },
              rowNumber: this.#rowNumber,
            },
          } as Token<TrackLocation>;
        }
        return {
          value: "",
          delimiter: Delimiter.EOF,
          delimiterLength: 0,
        } as Token<TrackLocation>;
      }
      return null;
    }

    if (!this.#trackLocation) {
      return this.#nextFieldNoLocation() as Token<TrackLocation>;
    }
    return this.#nextFieldWithLocation() as Token<TrackLocation>;
  }

  // ==================== No-Location Parsing Methods ====================

  /**
   * Fast path: Parse next field without location tracking.
   */
  #nextFieldNoLocation(): Token<false> | null {
    const code = this.#buffer.charCodeAt(this.#bufferOffset);

    // Empty field at start of record or between delimiters
    if (code === this.#delimiterCode) {
      this.#bufferOffset += this.#fieldDelimiterLength;
      this.#pendingTrailingFieldEOF = this.#bufferOffset >= this.#buffer.length;
      return {
        value: "",
        delimiter: Delimiter.Field,
        delimiterLength: this.#fieldDelimiterLength,
      };
    }

    // Empty field at end of record (CRLF)
    if (
      code === CR &&
      this.#buffer.charCodeAt(this.#bufferOffset + 1) === LF_CODE
    ) {
      this.#bufferOffset += 2;
      return { value: "", delimiter: Delimiter.Record, delimiterLength: 2 };
    }

    // Empty field at end of record (LF)
    if (code === LF_CODE) {
      this.#bufferOffset += 1;
      return { value: "", delimiter: Delimiter.Record, delimiterLength: 1 };
    }

    // Parse quoted field
    if (code === this.#quotationCode) {
      return this.#parseQuotedFieldNoLocation();
    }

    // Parse unquoted field
    return this.#parseUnquotedFieldNoLocation();
  }

  #parseQuotedFieldNoLocation(): Token<false> | null {
    const baseOffset = this.#bufferOffset;
    const buf = this.#buffer;
    const quotCode = this.#quotationCode;
    let localOffset = 1;
    const segments: string[] = [];
    let segmentStart = localOffset;

    let curCode = buf.charCodeAt(baseOffset + localOffset);
    if (Number.isNaN(curCode)) {
      if (!this.#flush) {
        return null;
      }
      this.#throwUnexpectedEOF();
    }

    let nextCode = buf.charCodeAt(baseOffset + localOffset + 1);

    do {
      if (curCode === quotCode) {
        if (nextCode === quotCode) {
          // Escaped quote
          segments.push(
            buf.slice(baseOffset + segmentStart, baseOffset + localOffset + 1),
          );
          localOffset += 2;
          segmentStart = localOffset;
          curCode = buf.charCodeAt(baseOffset + localOffset);
          nextCode = buf.charCodeAt(baseOffset + localOffset + 1);
          continue;
        }

        if (Number.isNaN(nextCode) && !this.#flush) {
          return null;
        }

        // End of quoted field - collect value
        if (localOffset > segmentStart) {
          segments.push(
            buf.slice(baseOffset + segmentStart, baseOffset + localOffset),
          );
        }

        const value = segments.length === 1 ? segments[0]! : segments.join("");
        localOffset++; // skip closing quote

        // Inline delimiter determination using charCodeAt
        const delimCode = buf.charCodeAt(baseOffset + localOffset);

        // Field delimiter
        if (delimCode === this.#delimiterCode) {
          this.#bufferOffset =
            baseOffset + localOffset + this.#fieldDelimiterLength;
          this.#pendingTrailingFieldEOF =
            this.#bufferOffset >= this.#buffer.length;
          return {
            value,
            delimiter: Delimiter.Field,
            delimiterLength: this.#fieldDelimiterLength,
          };
        }

        // Record delimiter (CRLF)
        if (
          delimCode === CR &&
          buf.charCodeAt(baseOffset + localOffset + 1) === LF_CODE
        ) {
          this.#bufferOffset = baseOffset + localOffset + 2;
          return { value, delimiter: Delimiter.Record, delimiterLength: 2 };
        }

        // Record delimiter (LF)
        if (delimCode === LF_CODE) {
          this.#bufferOffset = baseOffset + localOffset + 1;
          return { value, delimiter: Delimiter.Record, delimiterLength: 1 };
        }

        // EOF
        this.#bufferOffset = baseOffset + localOffset;
        return { value, delimiter: Delimiter.EOF, delimiterLength: 0 };
      }

      localOffset++;
      curCode = nextCode;
      nextCode = buf.charCodeAt(baseOffset + localOffset + 1);
    } while (!Number.isNaN(curCode));

    if (this.#flush) {
      this.#throwUnexpectedEOF();
    }
    return null;
  }

  #parseUnquotedFieldNoLocation(): Token<false> | null {
    const startOffset = this.#bufferOffset;
    const bufLen = this.#buffer.length;
    const buf = this.#buffer;
    const delimCode = this.#delimiterCode;
    const quotCode = this.#quotationCode;
    let localEnd = 0;

    while (startOffset + localEnd < bufLen) {
      const code = buf.charCodeAt(startOffset + localEnd);

      // Field delimiter - inline determination
      if (code === delimCode) {
        const value = buf.slice(startOffset, startOffset + localEnd);
        this.#bufferOffset =
          startOffset + localEnd + this.#fieldDelimiterLength;
        this.#pendingTrailingFieldEOF = this.#bufferOffset >= bufLen;
        return {
          value,
          delimiter: Delimiter.Field,
          delimiterLength: this.#fieldDelimiterLength,
        };
      }

      // Record delimiter (CRLF)
      if (
        code === CR &&
        buf.charCodeAt(startOffset + localEnd + 1) === LF_CODE
      ) {
        const value = buf.slice(startOffset, startOffset + localEnd);
        this.#bufferOffset = startOffset + localEnd + 2;
        return { value, delimiter: Delimiter.Record, delimiterLength: 2 };
      }

      // Record delimiter (LF)
      if (code === LF_CODE) {
        const value = buf.slice(startOffset, startOffset + localEnd);
        this.#bufferOffset = startOffset + localEnd + 1;
        return { value, delimiter: Delimiter.Record, delimiterLength: 1 };
      }

      // Quotation in middle of unquoted field - RFC 4180 violation but we handle it
      // by throwing an error since quotes shouldn't appear in unquoted fields
      if (code === quotCode) {
        // Continue scanning until we find a delimiter or EOL, then throw error
        // This will be caught when parsePartialQuotedFieldNoLocation finds no closing quote
        return this.#parsePartialQuotedFieldNoLocation(startOffset, localEnd);
      }

      localEnd++;
    }

    // End of buffer
    if (!this.#flush) {
      return null;
    }

    // EOF
    const value = buf.slice(startOffset, startOffset + localEnd);
    this.#bufferOffset = startOffset + localEnd;
    return { value, delimiter: Delimiter.EOF, delimiterLength: 0 };
  }

  /**
   * Parse a field that starts unquoted but contains a quoted section.
   * E.g., `a"quoted"b` or `a"unclosed` (which throws error)
   */
  #parsePartialQuotedFieldNoLocation(
    startOffset: number,
    prefixLen: number,
  ): Token<false> | null {
    const buf = this.#buffer;
    const quotCode = this.#quotationCode;
    const segments: string[] = [];

    // Add prefix (unquoted part before the quote)
    if (prefixLen > 0) {
      segments.push(buf.slice(startOffset, startOffset + prefixLen));
    }

    let localOffset = prefixLen + 1; // Skip opening quote
    let segmentStart = localOffset;

    let curCode = buf.charCodeAt(startOffset + localOffset);
    if (Number.isNaN(curCode)) {
      if (!this.#flush) {
        return null;
      }
      this.#throwUnexpectedEOF();
    }

    let nextCode = buf.charCodeAt(startOffset + localOffset + 1);

    while (!Number.isNaN(curCode)) {
      if (curCode === quotCode) {
        if (nextCode === quotCode) {
          // Escaped quote
          segments.push(
            buf.slice(
              startOffset + segmentStart,
              startOffset + localOffset + 1,
            ),
          );
          localOffset += 2;
          segmentStart = localOffset;
          curCode = buf.charCodeAt(startOffset + localOffset);
          nextCode = buf.charCodeAt(startOffset + localOffset + 1);
          continue;
        }

        if (Number.isNaN(nextCode) && !this.#flush) {
          return null;
        }

        // End of quoted section - collect value
        if (localOffset > segmentStart) {
          segments.push(
            buf.slice(startOffset + segmentStart, startOffset + localOffset),
          );
        }

        localOffset++; // skip closing quote

        // Check what follows the quoted section
        const afterCode = buf.charCodeAt(startOffset + localOffset);

        // Continue parsing if more unquoted content follows
        if (
          !Number.isNaN(afterCode) &&
          afterCode !== this.#delimiterCode &&
          afterCode !== CR &&
          afterCode !== LF_CODE
        ) {
          // Recursively handle the rest (could have more quoted sections)
          this.#bufferOffset = startOffset + localOffset;
          const rest = this.#parseUnquotedFieldNoLocation();
          if (rest === null) {
            return null;
          }
          segments.push(rest.value);
          return {
            value: segments.join(""),
            delimiter: rest.delimiter,
            delimiterLength: rest.delimiterLength,
          };
        }

        const value = segments.join("");

        // Field delimiter
        if (afterCode === this.#delimiterCode) {
          this.#bufferOffset =
            startOffset + localOffset + this.#fieldDelimiterLength;
          this.#pendingTrailingFieldEOF =
            this.#bufferOffset >= this.#buffer.length;
          return {
            value,
            delimiter: Delimiter.Field,
            delimiterLength: this.#fieldDelimiterLength,
          };
        }

        // Record delimiter (CRLF)
        if (
          afterCode === CR &&
          buf.charCodeAt(startOffset + localOffset + 1) === LF_CODE
        ) {
          this.#bufferOffset = startOffset + localOffset + 2;
          return { value, delimiter: Delimiter.Record, delimiterLength: 2 };
        }

        // Record delimiter (LF)
        if (afterCode === LF_CODE) {
          this.#bufferOffset = startOffset + localOffset + 1;
          return { value, delimiter: Delimiter.Record, delimiterLength: 1 };
        }

        // EOF
        this.#bufferOffset = startOffset + localOffset;
        return { value, delimiter: Delimiter.EOF, delimiterLength: 0 };
      }

      localOffset++;
      curCode = nextCode;
      nextCode = buf.charCodeAt(startOffset + localOffset + 1);
    }

    if (this.#flush) {
      this.#throwUnexpectedEOF();
    }
    return null;
  }

  // ==================== Location-Tracking Parsing Methods ====================

  /**
   * Full path: Parse next field with location tracking.
   */
  #nextFieldWithLocation(): Token<true> | null {
    const firstChar = this.#buffer[this.#bufferOffset];

    // Empty field at start of record or between delimiters
    if (firstChar === this.#delimiter) {
      const start: Position = { ...this.#cursor };
      this.#bufferOffset += this.#fieldDelimiterLength;
      this.#cursor.column += this.#fieldDelimiterLength;
      this.#cursor.offset += this.#fieldDelimiterLength;
      this.#pendingTrailingFieldEOF = this.#bufferOffset >= this.#buffer.length;
      return {
        value: "",
        delimiter: Delimiter.Field,
        delimiterLength: this.#fieldDelimiterLength,
        location: {
          start,
          end: { ...this.#cursor },
          rowNumber: this.#rowNumber,
        },
      };
    }

    // Empty field at end of record (CRLF)
    if (firstChar === "\r" && this.#buffer[this.#bufferOffset + 1] === "\n") {
      const start: Position = { ...this.#cursor };
      this.#bufferOffset += 2;
      this.#cursor.line++;
      this.#cursor.column = 1;
      this.#cursor.offset += 2;
      const rowNum = this.#rowNumber++;
      return {
        value: "",
        delimiter: Delimiter.Record,
        delimiterLength: 2,
        location: {
          start,
          end: { ...this.#cursor },
          rowNumber: rowNum,
        },
      };
    }

    // Empty field at end of record (LF)
    if (firstChar === "\n") {
      const start: Position = { ...this.#cursor };
      this.#bufferOffset += 1;
      this.#cursor.line++;
      this.#cursor.column = 1;
      this.#cursor.offset += 1;
      const rowNum = this.#rowNumber++;
      return {
        value: "",
        delimiter: Delimiter.Record,
        delimiterLength: 1,
        location: {
          start,
          end: { ...this.#cursor },
          rowNumber: rowNum,
        },
      };
    }

    // Parse quoted field
    if (firstChar === this.#quotation) {
      return this.#parseQuotedFieldWithLocation();
    }

    // Parse unquoted field
    return this.#parseUnquotedFieldWithLocation();
  }

  #parseQuotedFieldWithLocation(): Token<true> | null {
    const start: Position = { ...this.#cursor };
    const baseOffset = this.#bufferOffset;
    let localOffset = 1;
    let column = 2;
    let line = 0;

    const segments: string[] = [];
    let segmentStart = localOffset;

    let cur: string | undefined = this.#buffer[baseOffset + localOffset];
    if (cur === undefined) {
      if (!this.#flush) {
        return null;
      }
      this.#throwUnexpectedEOFWithLocation();
    }

    let next: string | undefined = this.#buffer[baseOffset + localOffset + 1];

    do {
      if (cur === this.#quotation) {
        if (next === this.#quotation) {
          segments.push(
            this.#buffer.slice(
              baseOffset + segmentStart,
              baseOffset + localOffset + 1,
            ),
          );
          localOffset += 2;
          segmentStart = localOffset;
          cur = this.#buffer[baseOffset + localOffset];
          next = this.#buffer[baseOffset + localOffset + 1];
          column += 2;
          continue;
        }

        if (next === undefined && !this.#flush) {
          return null;
        }

        // End of quoted field - collect value
        if (localOffset > segmentStart) {
          segments.push(
            this.#buffer.slice(
              baseOffset + segmentStart,
              baseOffset + localOffset,
            ),
          );
        }

        const value = segments.length === 1 ? segments[0]! : segments.join("");
        localOffset++; // skip closing quote
        this.#cursor.column += column;
        this.#cursor.offset += localOffset;
        this.#cursor.line += line;

        // Inline delimiter determination
        const nextChar = this.#buffer[baseOffset + localOffset];

        // Field delimiter
        if (nextChar === this.#delimiter) {
          const end: Position = { ...this.#cursor };
          this.#bufferOffset =
            baseOffset + localOffset + this.#fieldDelimiterLength;
          this.#cursor.column += this.#fieldDelimiterLength;
          this.#cursor.offset += this.#fieldDelimiterLength;
          this.#pendingTrailingFieldEOF =
            this.#bufferOffset >= this.#buffer.length;
          return {
            value,
            delimiter: Delimiter.Field,
            delimiterLength: this.#fieldDelimiterLength,
            location: { start, end, rowNumber: this.#rowNumber },
          };
        }

        // Record delimiter (CRLF)
        if (
          nextChar === "\r" &&
          this.#buffer[baseOffset + localOffset + 1] === "\n"
        ) {
          const end: Position = { ...this.#cursor };
          this.#bufferOffset = baseOffset + localOffset + 2;
          this.#cursor.line++;
          this.#cursor.column = 1;
          this.#cursor.offset += 2;
          const rowNum = this.#rowNumber++;
          return {
            value,
            delimiter: Delimiter.Record,
            delimiterLength: 2,
            location: { start, end, rowNumber: rowNum },
          };
        }

        // Record delimiter (LF)
        if (nextChar === "\n") {
          const end: Position = { ...this.#cursor };
          this.#bufferOffset = baseOffset + localOffset + 1;
          this.#cursor.line++;
          this.#cursor.column = 1;
          this.#cursor.offset += 1;
          const rowNum = this.#rowNumber++;
          return {
            value,
            delimiter: Delimiter.Record,
            delimiterLength: 1,
            location: { start, end, rowNumber: rowNum },
          };
        }

        // EOF
        this.#bufferOffset = baseOffset + localOffset;
        return {
          value,
          delimiter: Delimiter.EOF,
          delimiterLength: 0,
          location: {
            start,
            end: { ...this.#cursor },
            rowNumber: this.#rowNumber,
          },
        };
      }

      if (cur === LF) {
        line++;
        column = 1;
      } else {
        column++;
      }

      localOffset++;
      cur = next;
      next = this.#buffer[baseOffset + localOffset + 1];
    } while (cur !== undefined);

    if (this.#flush) {
      this.#throwUnexpectedEOFWithLocation();
    }
    return null;
  }

  #parseUnquotedFieldWithLocation(): Token<true> | null {
    const start: Position = { ...this.#cursor };
    const startOffset = this.#bufferOffset;
    const bufLen = this.#buffer.length;
    let localEnd = 0;

    while (startOffset + localEnd < bufLen) {
      const ch = this.#buffer[startOffset + localEnd];

      // Field delimiter - inline determination
      if (ch === this.#delimiter) {
        const value = this.#buffer.slice(startOffset, startOffset + localEnd);
        this.#cursor.column += localEnd;
        this.#cursor.offset += localEnd;
        const end: Position = { ...this.#cursor };
        this.#bufferOffset =
          startOffset + localEnd + this.#fieldDelimiterLength;
        this.#cursor.column += this.#fieldDelimiterLength;
        this.#cursor.offset += this.#fieldDelimiterLength;
        this.#pendingTrailingFieldEOF = this.#bufferOffset >= bufLen;
        return {
          value,
          delimiter: Delimiter.Field,
          delimiterLength: this.#fieldDelimiterLength,
          location: { start, end, rowNumber: this.#rowNumber },
        };
      }

      // Record delimiter (CRLF)
      if (ch === "\r" && this.#buffer[startOffset + localEnd + 1] === "\n") {
        const value = this.#buffer.slice(startOffset, startOffset + localEnd);
        this.#cursor.column += localEnd;
        this.#cursor.offset += localEnd;
        const end: Position = { ...this.#cursor };
        this.#bufferOffset = startOffset + localEnd + 2;
        this.#cursor.line++;
        this.#cursor.column = 1;
        this.#cursor.offset += 2;
        const rowNum = this.#rowNumber++;
        return {
          value,
          delimiter: Delimiter.Record,
          delimiterLength: 2,
          location: { start, end, rowNumber: rowNum },
        };
      }

      // Record delimiter (LF)
      if (ch === "\n") {
        const value = this.#buffer.slice(startOffset, startOffset + localEnd);
        this.#cursor.column += localEnd;
        this.#cursor.offset += localEnd;
        const end: Position = { ...this.#cursor };
        this.#bufferOffset = startOffset + localEnd + 1;
        this.#cursor.line++;
        this.#cursor.column = 1;
        this.#cursor.offset += 1;
        const rowNum = this.#rowNumber++;
        return {
          value,
          delimiter: Delimiter.Record,
          delimiterLength: 1,
          location: { start, end, rowNumber: rowNum },
        };
      }

      // Quotation in middle of unquoted field - parse as quoted section
      if (ch === this.#quotation) {
        return this.#parsePartialQuotedFieldWithLocation(
          start,
          startOffset,
          localEnd,
        );
      }

      localEnd++;
    }

    // End of buffer
    if (!this.#flush) {
      return null;
    }

    // EOF
    const value = this.#buffer.slice(startOffset, startOffset + localEnd);
    this.#bufferOffset = startOffset + localEnd;
    this.#cursor.column += localEnd;
    this.#cursor.offset += localEnd;
    return {
      value,
      delimiter: Delimiter.EOF,
      delimiterLength: 0,
      location: {
        start,
        end: { ...this.#cursor },
        rowNumber: this.#rowNumber,
      },
    };
  }

  /**
   * Parse a field that starts unquoted but contains a quoted section (with location tracking).
   * E.g., `a"quoted"b` or `a"unclosed` (which throws error)
   */
  #parsePartialQuotedFieldWithLocation(
    start: Position,
    startOffset: number,
    prefixLen: number,
  ): Token<true> | null {
    const buf = this.#buffer;
    const quotation = this.#quotation;
    const segments: string[] = [];

    // Add prefix (unquoted part before the quote)
    if (prefixLen > 0) {
      segments.push(buf.slice(startOffset, startOffset + prefixLen));
    }

    // Update cursor for the prefix and opening quote
    this.#cursor.column += prefixLen + 1;
    this.#cursor.offset += prefixLen + 1;

    let localOffset = prefixLen + 1; // Skip opening quote
    let segmentStart = localOffset;
    let line = 0;
    let column = 0;

    let cur: string | undefined = buf[startOffset + localOffset];
    if (cur === undefined) {
      if (!this.#flush) {
        return null;
      }
      this.#throwUnexpectedEOFWithLocation();
    }

    let next: string | undefined = buf[startOffset + localOffset + 1];

    while (cur !== undefined) {
      if (cur === quotation) {
        if (next === quotation) {
          // Escaped quote
          segments.push(
            buf.slice(
              startOffset + segmentStart,
              startOffset + localOffset + 1,
            ),
          );
          localOffset += 2;
          segmentStart = localOffset;
          cur = buf[startOffset + localOffset];
          next = buf[startOffset + localOffset + 1];
          column += 2;
          continue;
        }

        if (next === undefined && !this.#flush) {
          return null;
        }

        // End of quoted section - collect value
        if (localOffset > segmentStart) {
          segments.push(
            buf.slice(startOffset + segmentStart, startOffset + localOffset),
          );
        }

        localOffset++; // skip closing quote
        this.#cursor.column += column + 1;
        this.#cursor.offset += localOffset - prefixLen - 1;
        this.#cursor.line += line;

        // Check what follows the quoted section
        const afterChar = buf[startOffset + localOffset];

        // Continue parsing if more unquoted content follows
        if (
          afterChar !== undefined &&
          afterChar !== this.#delimiter &&
          afterChar !== "\r" &&
          afterChar !== "\n"
        ) {
          // Recursively handle the rest (could have more quoted sections)
          this.#bufferOffset = startOffset + localOffset;
          const rest = this.#parseUnquotedFieldWithLocation();
          if (rest === null) {
            return null;
          }
          segments.push(rest.value);
          return {
            value: segments.join(""),
            delimiter: rest.delimiter,
            delimiterLength: rest.delimiterLength,
            location: {
              start,
              end: rest.location.end,
              rowNumber: rest.location.rowNumber,
            },
          };
        }

        const value = segments.join("");
        const end: Position = { ...this.#cursor };

        // Field delimiter
        if (afterChar === this.#delimiter) {
          this.#bufferOffset =
            startOffset + localOffset + this.#fieldDelimiterLength;
          this.#cursor.column += this.#fieldDelimiterLength;
          this.#cursor.offset += this.#fieldDelimiterLength;
          this.#pendingTrailingFieldEOF =
            this.#bufferOffset >= this.#buffer.length;
          return {
            value,
            delimiter: Delimiter.Field,
            delimiterLength: this.#fieldDelimiterLength,
            location: { start, end, rowNumber: this.#rowNumber },
          };
        }

        // Record delimiter (CRLF)
        if (afterChar === "\r" && buf[startOffset + localOffset + 1] === "\n") {
          this.#bufferOffset = startOffset + localOffset + 2;
          this.#cursor.line++;
          this.#cursor.column = 1;
          this.#cursor.offset += 2;
          const rowNum = this.#rowNumber++;
          return {
            value,
            delimiter: Delimiter.Record,
            delimiterLength: 2,
            location: { start, end, rowNumber: rowNum },
          };
        }

        // Record delimiter (LF)
        if (afterChar === "\n") {
          this.#bufferOffset = startOffset + localOffset + 1;
          this.#cursor.line++;
          this.#cursor.column = 1;
          this.#cursor.offset += 1;
          const rowNum = this.#rowNumber++;
          return {
            value,
            delimiter: Delimiter.Record,
            delimiterLength: 1,
            location: { start, end, rowNumber: rowNum },
          };
        }

        // EOF
        this.#bufferOffset = startOffset + localOffset;
        return {
          value,
          delimiter: Delimiter.EOF,
          delimiterLength: 0,
          location: { start, end, rowNumber: this.#rowNumber },
        };
      }

      if (cur === LF) {
        line++;
        column = 0;
      } else {
        column++;
      }

      localOffset++;
      cur = next;
      next = buf[startOffset + localOffset + 1];
    }

    if (this.#flush) {
      this.#throwUnexpectedEOFWithLocation();
    }
    return null;
  }
}
