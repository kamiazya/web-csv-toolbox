/**
 * Unit tests for edge case handlers
 */

import { describe, it, expect } from "vitest";
import {
	detectBOM,
	analyzeCRLF,
	detectEmptyField,
	analyzeQuoteEscaping,
	validateRecord,
	analyzeConsecutiveSeparators,
	EdgeCaseProcessor,
} from "./edge-cases.ts";
import { SEP_TYPE_COMMA, SEP_TYPE_LF } from "../core/types.ts";

describe("edge-cases", () => {
	describe("detectBOM", () => {
		it("should detect UTF-8 BOM", () => {
			const buffer = new Uint8Array([0xef, 0xbb, 0xbf, 0x48, 0x69]);
			const info = detectBOM(buffer);
			expect(info.hasBOM).toBe(true);
			expect(info.dataOffset).toBe(3);
			expect(info.bytes).toEqual(new Uint8Array([0xef, 0xbb, 0xbf]));
		});

		it("should return false for non-BOM data", () => {
			const buffer = new Uint8Array([0x48, 0x65, 0x6c, 0x6c, 0x6f]);
			const info = detectBOM(buffer);
			expect(info.hasBOM).toBe(false);
			expect(info.dataOffset).toBe(0);
			expect(info.bytes).toBeNull();
		});

		it("should handle short buffer", () => {
			const buffer = new Uint8Array([0xef, 0xbb]);
			const info = detectBOM(buffer);
			expect(info.hasBOM).toBe(false);
		});
	});

	describe("analyzeCRLF", () => {
		it("should detect CRLF", () => {
			const buffer = new Uint8Array([0x48, 0x69, 0x0d, 0x0a]); // Hi\r\n
			const info = analyzeCRLF(buffer, 3);
			expect(info.hasCR).toBe(true);
			expect(info.adjustedEnd).toBe(2);
			expect(info.lfPosition).toBe(3);
		});

		it("should handle plain LF", () => {
			const buffer = new Uint8Array([0x48, 0x69, 0x0a]); // Hi\n
			const info = analyzeCRLF(buffer, 2);
			expect(info.hasCR).toBe(false);
			expect(info.adjustedEnd).toBe(2);
		});

		it("should handle LF at position 0", () => {
			const buffer = new Uint8Array([0x0a]);
			const info = analyzeCRLF(buffer, 0);
			expect(info.hasCR).toBe(false);
			expect(info.adjustedEnd).toBe(0);
		});
	});

	describe("detectEmptyField", () => {
		it("should detect empty field (same offsets)", () => {
			const buffer = new Uint8Array([0x2c, 0x2c]); // ,,
			const info = detectEmptyField(0, 0, buffer);
			expect(info.isEmpty).toBe(true);
		});

		it("should detect empty field with CR", () => {
			const buffer = new Uint8Array([0x0d]); // \r
			const info = detectEmptyField(0, 1, buffer);
			expect(info.isEmpty).toBe(true);
		});

		it("should detect non-empty field", () => {
			const buffer = new Uint8Array([0x48, 0x69]); // Hi
			const info = detectEmptyField(0, 2, buffer);
			expect(info.isEmpty).toBe(false);
		});
	});

	describe("analyzeQuoteEscaping", () => {
		it("should detect and unescape escaped quotes", () => {
			const info = analyzeQuoteEscaping('"Hello ""World"""');
			expect(info.hasEscapedQuotes).toBe(true);
			expect(info.unescapedValue).toBe('Hello "World"');
		});

		it("should handle non-quoted field", () => {
			const info = analyzeQuoteEscaping("Hello World");
			expect(info.hasEscapedQuotes).toBe(false);
			expect(info.unescapedValue).toBe("Hello World");
		});

		it("should handle quoted field without escapes", () => {
			const info = analyzeQuoteEscaping('"Hello World"');
			expect(info.hasEscapedQuotes).toBe(false);
			expect(info.unescapedValue).toBe('"Hello World"');
		});

		it("should count quotes", () => {
			const info = analyzeQuoteEscaping('"A""B""C"');
			expect(info.quoteCount).toBe(6);
		});
	});

	describe("validateRecord", () => {
		it("should validate normal record", () => {
			const validation = validateRecord(["a", "b", "c"], 0);
			expect(validation.isValid).toBe(true);
			expect(validation.error).toBeNull();
			expect(validation.isEmptyRecord).toBe(false);
		});

		it("should detect empty record", () => {
			const validation = validateRecord([""], 0);
			expect(validation.isValid).toBe(true);
			expect(validation.isEmptyRecord).toBe(true);
		});

		it("should detect all-empty-fields record", () => {
			const validation = validateRecord(["", "", ""], 0);
			expect(validation.isValid).toBe(true);
			expect(validation.isEmptyRecord).toBe(true);
		});

		it("should detect unclosed quotes", () => {
			const validation = validateRecord(['"unclosed'], 0);
			expect(validation.isValid).toBe(false);
			expect(validation.error).toContain("Unclosed quote");
		});
	});

	describe("analyzeConsecutiveSeparators", () => {
		it("should detect normal separator", () => {
			const separators = [
				{ offset: 10, type: SEP_TYPE_COMMA },
				{ offset: 20, type: SEP_TYPE_COMMA },
			];
			const analysis = analyzeConsecutiveSeparators(separators, 0);
			expect(analysis.type).toBe("normal");
			expect(analysis.count).toBe(1);
		});

		it("should detect consecutive commas", () => {
			const separators = [
				{ offset: 10, type: SEP_TYPE_COMMA },
				{ offset: 11, type: SEP_TYPE_COMMA },
				{ offset: 12, type: SEP_TYPE_COMMA },
			];
			const analysis = analyzeConsecutiveSeparators(separators, 0);
			expect(analysis.type).toBe("consecutive-commas");
			expect(analysis.count).toBe(3);
			expect(analysis.emptyFields).toEqual(["", ""]);
		});

		it("should detect consecutive LFs", () => {
			const separators = [
				{ offset: 10, type: SEP_TYPE_LF },
				{ offset: 11, type: SEP_TYPE_LF },
			];
			const analysis = analyzeConsecutiveSeparators(separators, 0);
			expect(analysis.type).toBe("consecutive-lfs");
			expect(analysis.count).toBe(2);
		});
	});

	describe("EdgeCaseProcessor", () => {
		it("should process first chunk with BOM", () => {
			const processor = new EdgeCaseProcessor();
			const chunk = new Uint8Array([0xef, 0xbb, 0xbf, 0x48, 0x69]);
			const result = processor.processFirstChunk(chunk);

			expect(result.bomInfo.hasBOM).toBe(true);
			expect(result.processedChunk).toEqual(new Uint8Array([0x48, 0x69]));
		});

		it("should process field value", () => {
			const processor = new EdgeCaseProcessor();
			const buffer = new Uint8Array([0x48, 0x69, 0x0d, 0x0a]); // Hi\r\n

			const result = processor.processFieldValue(buffer, 0, 3, true);
			expect(result.value).toBe("Hi");
			expect(result.isEmpty).toBe(false);
			expect(result.crlfInfo?.hasCR).toBe(true);
		});

		it("should handle empty field", () => {
			const processor = new EdgeCaseProcessor();
			const buffer = new Uint8Array([0x2c]); // ,

			const result = processor.processFieldValue(buffer, 0, 0, false);
			expect(result.value).toBe("");
			expect(result.isEmpty).toBe(true);
		});

		it("should unescape quotes in field value", () => {
			const processor = new EdgeCaseProcessor();
			const text = '"Hello ""World"""';
			const buffer = new TextEncoder().encode(text);

			const result = processor.processFieldValue(buffer, 0, buffer.length, false);
			expect(result.value).toBe('Hello "World"');
		});
	});
});
