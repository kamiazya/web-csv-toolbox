/**
 * Edge Case Handlers for CSV Parsing
 *
 * This module provides specialized handlers for CSV edge cases as defined
 * in the architecture specification:
 * - BOM (Byte Order Mark) detection and removal
 * - CRLF (\r\n) line ending normalization
 * - Empty lines and empty fields
 * - Quote escaping ("")
 */

import type { Separator } from "../core/types.ts";
import { SEP_TYPE_COMMA, SEP_TYPE_LF } from "../core/types.ts";

/**
 * BOM detection result
 */
export interface BOMInfo {
	/** Whether BOM is present */
	hasBOM: boolean;
	/** BOM bytes if present */
	bytes: Uint8Array | null;
	/** Offset where actual data starts */
	dataOffset: number;
}

/**
 * Detects and analyzes BOM at the start of a buffer
 *
 * According to spec:
 * > BOM (0xEF,0xBB,0xBF): Check only the first chunk.
 * > If present, use subarray(3) to skip it (zero-copy).
 *
 * @param buffer - Byte buffer to check
 * @returns BOM information
 */
export function detectBOM(buffer: Uint8Array): BOMInfo {
	if (buffer.length < 3) {
		return { hasBOM: false, bytes: null, dataOffset: 0 };
	}

	const hasBOM =
		buffer[0] === 0xef && buffer[1] === 0xbb && buffer[2] === 0xbf;

	return {
		hasBOM,
		bytes: hasBOM ? buffer.subarray(0, 3) : null,
		dataOffset: hasBOM ? 3 : 0,
	};
}

/**
 * CRLF handling information
 */
export interface CRLFInfo {
	/** Whether CR was found before the LF */
	hasCR: boolean;
	/** Adjusted end position (excludes CR) */
	adjustedEnd: number;
	/** Original LF position */
	lfPosition: number;
}

/**
 * Analyzes CRLF line ending at a given LF position
 *
 * According to spec:
 * > CRLF (\r\n): GPU returns only \n position.
 * > JS checks inputBytes[index_of_LF - 1] == 0x0D (\r).
 * > If true, adjust field end position by -1.
 *
 * @param buffer - Input buffer
 * @param lfPosition - Position of the LF character
 * @returns CRLF analysis
 */
export function analyzeCRLF(buffer: Uint8Array, lfPosition: number): CRLFInfo {
	if (lfPosition === 0) {
		return { hasCR: false, adjustedEnd: lfPosition, lfPosition };
	}

	const hasCR = buffer[lfPosition - 1] === 0x0d; // \r

	return {
		hasCR,
		adjustedEnd: hasCR ? lfPosition - 1 : lfPosition,
		lfPosition,
	};
}

/**
 * Empty field detection result
 */
export interface EmptyFieldInfo {
	/** Whether the field is empty */
	isEmpty: boolean;
	/** Whether it's an empty line (multiple consecutive LFs) */
	isEmptyLine: boolean;
}

/**
 * Detects empty fields and empty lines
 *
 * According to spec:
 * > Empty line: lastIndex and currentIndex are adjacent
 * > (or adjacent excluding \r).
 *
 * @param startOffset - Start of field
 * @param endOffset - End of field (before separator)
 * @param buffer - Input buffer for validation
 * @returns Empty field information
 */
export function detectEmptyField(
	startOffset: number,
	endOffset: number,
	buffer: Uint8Array,
): EmptyFieldInfo {
	// Simple case: offsets are equal
	if (startOffset === endOffset) {
		return { isEmpty: true, isEmptyLine: false };
	}

	// Check if the only character between is \r (part of CRLF)
	if (endOffset - startOffset === 1) {
		if (buffer[startOffset] === 0x0d) {
			return { isEmpty: true, isEmptyLine: false };
		}
	}

	return { isEmpty: false, isEmptyLine: false };
}

/**
 * Quote escaping analysis
 */
export interface QuoteEscapeInfo {
	/** Number of quote characters found */
	quoteCount: number;
	/** Whether the field has escaped quotes ("") */
	hasEscapedQuotes: boolean;
	/** Unescaped field value (if quotes were escaped) */
	unescapedValue: string;
}

/**
 * Analyzes and handles quote escaping in a field value
 *
 * CSV standard: "" inside a quoted field represents a single "
 *
 * Note: The GPU shader handles quote state tracking via XOR,
 * which naturally handles "" as a toggle-toggle (no state change).
 * This function is for post-processing field values.
 *
 * @param fieldValue - Raw field value (may contain escaped quotes)
 * @returns Quote escape analysis
 */
export function analyzeQuoteEscaping(fieldValue: string): QuoteEscapeInfo {
	const quoteCount = (fieldValue.match(/"/g) || []).length;

	// Check if field is quoted and contains escaped quotes
	const isQuoted =
		fieldValue.length >= 2 &&
		fieldValue[0] === '"' &&
		fieldValue[fieldValue.length - 1] === '"';

	if (isQuoted && quoteCount > 2) {
		// Remove outer quotes and unescape inner quotes
		const innerContent = fieldValue.slice(1, -1);
		const unescapedValue = innerContent.replace(/""/g, '"');

		return {
			quoteCount,
			hasEscapedQuotes: true,
			unescapedValue,
		};
	}

	return {
		quoteCount,
		hasEscapedQuotes: false,
		unescapedValue: fieldValue,
	};
}

/**
 * Record validation result
 */
export interface RecordValidation {
	/** Whether the record is valid */
	isValid: boolean;
	/** Validation error message if invalid */
	error: string | null;
	/** Whether this is an empty record (all fields empty) */
	isEmptyRecord: boolean;
}

/**
 * Validates a parsed CSV record for edge cases
 *
 * @param fields - Array of field values
 * @param recordIndex - Record number for error reporting
 * @returns Validation result
 */
export function validateRecord(
	fields: string[],
	recordIndex: number,
): RecordValidation {
	// Empty record (all fields are empty strings)
	const isEmptyRecord = fields.every((f) => f === "");

	if (isEmptyRecord && fields.length === 1) {
		// Single empty field - this is a valid empty line
		return {
			isValid: true,
			error: null,
			isEmptyRecord: true,
		};
	}

	// Check for unclosed quotes (shouldn't happen with correct GPU parsing)
	const hasUnclosedQuotes = fields.some((f) => {
		const quoteCount = (f.match(/"/g) || []).length;
		return quoteCount % 2 !== 0;
	});

	if (hasUnclosedQuotes) {
		return {
			isValid: false,
			error: `Record ${recordIndex}: Unclosed quote detected`,
			isEmptyRecord: false,
		};
	}

	return {
		isValid: true,
		error: null,
		isEmptyRecord,
	};
}

/**
 * Separator sequence analysis
 */
export interface SeparatorSequence {
	/** Type of sequence */
	type: "normal" | "consecutive-commas" | "consecutive-lfs";
	/** Number of consecutive separators */
	count: number;
	/** Generated empty fields */
	emptyFields: string[];
}

/**
 * Analyzes consecutive separators to handle empty fields
 *
 * According to spec:
 * > Empty fields: Consecutive separators indicate empty fields
 *
 * @param separators - Array of separators
 * @param startIndex - Start index in separator array
 * @returns Separator sequence analysis
 */
export function analyzeConsecutiveSeparators(
	separators: Separator[],
	startIndex: number,
): SeparatorSequence {
	if (startIndex >= separators.length) {
		return { type: "normal", count: 0, emptyFields: [] };
	}

	const firstSep = separators[startIndex];
	let count = 1;

	// Count consecutive separators of the same type
	while (
		startIndex + count < separators.length &&
		separators[startIndex + count].type === firstSep.type &&
		separators[startIndex + count].offset ===
			separators[startIndex + count - 1].offset + 1
	) {
		count++;
	}

	if (count === 1) {
		return { type: "normal", count: 1, emptyFields: [] };
	}

	// Generate empty fields for consecutive commas
	if (firstSep.type === SEP_TYPE_COMMA) {
		return {
			type: "consecutive-commas",
			count,
			emptyFields: new Array(count - 1).fill(""),
		};
	}

	// Consecutive LFs represent empty lines
	return {
		type: "consecutive-lfs",
		count,
		emptyFields: [],
	};
}

/**
 * Comprehensive edge case processor
 */
export class EdgeCaseProcessor {
	private bomDetected = false;

	/**
	 * Processes first chunk with BOM detection
	 */
	processFirstChunk(chunk: Uint8Array): {
		processedChunk: Uint8Array;
		bomInfo: BOMInfo;
	} {
		const bomInfo = detectBOM(chunk);
		this.bomDetected = bomInfo.hasBOM;

		return {
			processedChunk: bomInfo.hasBOM ? chunk.subarray(3) : chunk,
			bomInfo,
		};
	}

	/**
	 * Processes a field value with all edge case handling
	 */
	processFieldValue(
		buffer: Uint8Array,
		start: number,
		end: number,
		isBeforeLF: boolean,
	): {
		value: string;
		isEmpty: boolean;
		crlfInfo?: CRLFInfo;
	} {
		// Adjust for CRLF if this field is before a LF
		let adjustedEnd = end;
		let crlfInfo: CRLFInfo | undefined;

		if (isBeforeLF) {
			crlfInfo = analyzeCRLF(buffer, end);
			adjustedEnd = crlfInfo.adjustedEnd;
		}

		// Check if empty
		const emptyInfo = detectEmptyField(start, adjustedEnd, buffer);

		// Decode value
		const decoder = new TextDecoder("utf-8", { fatal: false });
		const rawValue = decoder.decode(buffer.subarray(start, adjustedEnd));

		// Handle quote escaping
		const quoteInfo = analyzeQuoteEscaping(rawValue);

		return {
			value: quoteInfo.unescapedValue,
			isEmpty: emptyInfo.isEmpty,
			crlfInfo,
		};
	}
}
