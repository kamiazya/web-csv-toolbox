import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fc from 'fast-check';
import { occurrences } from './occurrences';
import { escapeRegExp } from './escapeRegExp';

vi.mock('./escapeRegExp', () => ({
  escapeRegExp: vi.fn((str: string) => {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  })
}));

describe('occurrences', () => {
  beforeEach(() => {
    vi.mocked(escapeRegExp).mockClear();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('basic counting', () => {
    it('should count single character occurrences', () => {
      expect(occurrences('hello', 'l')).toBe(2);
      expect(occurrences('hello', 'h')).toBe(1);
      expect(occurrences('hello', 'z')).toBe(0);
    });

    it('should count multiple character occurrences', () => {
      expect(occurrences('hello world', 'lo')).toBe(1);
      expect(occurrences('banana', 'na')).toBe(2);
      expect(occurrences('javascript', 'script')).toBe(1);
    });

    it('should handle empty string input', () => {
      expect(occurrences('', 'a')).toBe(0);
      expect(occurrences('', '')).toBe(1);
    });

    it('should handle empty substring input', () => {
      expect(occurrences('hello', '')).toBe(6);
      expect(occurrences('test', '')).toBe(5);
    });

    it('should be case sensitive', () => {
      expect(occurrences('Hello hello', 'H')).toBe(1);
      expect(occurrences('Hello hello', 'h')).toBe(1);
      expect(occurrences('Hello hello', 'ello')).toBe(2);
    });
  });

  describe('overlapping patterns', () => {
    it('should count overlapping occurrences', () => {
      expect(occurrences('aaa', 'aa')).toBe(2);
      expect(occurrences('abababa', 'aba')).toBe(3);
      expect(occurrences('aaaa', 'aa')).toBe(3);
      expect(occurrences('mississippi', 'ss')).toBe(2);
    });

    it('should handle complex overlapping patterns', () => {
      expect(occurrences('abcabcabc', 'abcabc')).toBe(2);
    });
  });

  describe('special characters and regex patterns', () => {
    it('should handle regex special characters by escaping them', () => {
      expect(occurrences('a.b.c', '.')).toBe(2);
      expect(occurrences('a*b*c', '*')).toBe(2);
      expect(occurrences('a+b+c', '+')).toBe(2);
      expect(occurrences('a?b?c', '?')).toBe(2);
      expect(occurrences('a^b$c', '^')).toBe(1);
      expect(occurrences('a$b$c', '$')).toBe(2);
    });

    it('should call escapeRegExp for patterns', () => {
      occurrences('test', 'test');
      expect(escapeRegExp).toHaveBeenCalled();
    });

    it('should handle parentheses and brackets', () => {
      expect(occurrences('a(b)c', '(')).toBe(1);
      expect(occurrences('a)b)c', ')')).toBe(2);
      expect(occurrences('a[b]c', '[')).toBe(1);
      expect(occurrences('a{b}c', '{')).toBe(1);
    });

    it('should handle escape sequences', () => {
      expect(occurrences('a\nb\nc', '\n')).toBe(2);
      expect(occurrences('a\tb\tc', '\t')).toBe(2);
      expect(occurrences('a\\b\\c', '\\')).toBe(2);
    });
  });

  describe('property-based tests', () => {
    it('property: count should always be non-negative', () => {
      fc.assert(
        fc.property(fc.string(), fc.string(), (str, substr) => {
          const count = occurrences(str, substr);
          expect(count).toBeGreaterThanOrEqual(0);
        })
      );
    });

    it('property: if substring is longer than string, result should be 0', () => {
      fc.assert(
        fc.property(fc.string(), fc.string(), (str, substr) => {
          fc.pre(substr.length > str.length && substr.length > 0);
          const count = occurrences(str, substr);
          expect(count).toBe(0);
        })
      );
    });

    it('property: count should never exceed string length for non-empty substring', () => {
      fc.assert(
        fc.property(fc.string({ minLength: 1 }), fc.string({ minLength: 1 }), (str, substr) => {
          const count = occurrences(str, substr);
          expect(count).toBeLessThanOrEqual(str.length);
        })
      );
    });

    it('property: empty substring should always return string.length + 1', () => {
      fc.assert(
        fc.property(fc.string(), (str) => {
          const count = occurrences(str, '');
          expect(count).toBe(str.length + 1);
        })
      );
    });

    it('property: searching for the string itself should return 1', () => {
      fc.assert(
        fc.property(fc.string({ minLength: 1 }), (str) => {
          const count = occurrences(str, str);
          expect(count).toBe(1);
        })
      );
    });
  });

  describe('edge cases', () => {
    it('should handle very long strings', () => {
      const longString = 'a'.repeat(1000) + 'b' + 'a'.repeat(1000);
      expect(occurrences(longString, 'b')).toBe(1);
    });

    it('should handle unicode characters', () => {
      expect(occurrences('café café', 'é')).toBe(2);
      expect(occurrences('🎉🎉🎉', '🎉')).toBe(3);
      expect(occurrences('hello 世界', '世界')).toBe(1);
    });

    it('should handle whitespace patterns', () => {
      expect(occurrences('hello world', ' ')).toBe(1);
      expect(occurrences('hello  world', '  ')).toBe(1);
      expect(occurrences('   ', ' ')).toBe(3);
    });

    it('should return 0 when substring not found', () => {
      expect(occurrences('hello', 'x')).toBe(0);
      expect(occurrences('hello', 'hello world')).toBe(0);
      expect(occurrences('', 'non-empty')).toBe(0);
    });
  });
});