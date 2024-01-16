import { escapeRegExp } from "./escapeRegExp";

const PATTERN_CACHE = new Map<string, RegExp>();

/**
 * Get the number of occurrences of a substring in a string.
 * @param string The string.
 * @param substring The substring.
 * @returns The number of occurrences.
 */
export function occurrences(string: string, substring: string) {
  if (!PATTERN_CACHE.has(substring)) {
    PATTERN_CACHE.set(
      substring,
      new RegExp(`(?=(${escapeRegExp(substring)}))`, "g"),
    );
  }
  const pattern = PATTERN_CACHE.get(substring)!;
  return Array.from(string.matchAll(pattern), ([, v]) => v).length;
}
