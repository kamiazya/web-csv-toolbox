import { escapeRegExp } from "./escapeRegExp";

const PATTERN_CACHE = new Map<string, RegExp>();

/**
 * Get the number of occurrences of a substring in a string.
 * @param string The string.
 * @param substring The substring.
 * @returns The number of occurrences.
 */
export function occurrences(string: string, substring: string) {
  let pattern: RegExp;
  if (PATTERN_CACHE.has(substring)) {
    // biome-ignore lint/style/noNonNullAssertion: <explanation>
    pattern = PATTERN_CACHE.get(substring)!;
  } else {
    pattern = new RegExp(`(?=(${escapeRegExp(substring)}))`, "g");
    PATTERN_CACHE.set(substring, pattern);
  }
  return Array.from(string.matchAll(pattern), ([, v]) => v).length;
}
