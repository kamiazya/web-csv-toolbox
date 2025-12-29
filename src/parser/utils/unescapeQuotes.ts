/**
 * Removes outer quotation marks from quoted fields and unescapes internal escaped quotes
 *
 * **Optimization**: Hybrid approach (includes + replaceAll)
 * - Fast path for fields without escapes (~50% of cases)
 * - replaceAll only used when escapes are present
 * - No regex usage for high performance (Chromium: 3.7x, Firefox: 2.1x vs original)
 *
 * Benchmark results: See `benchmark/reports/56-unescape-quotes-optimization/RESULTS.md`
 *
 * @param value - The value to process
 * @param quotation - Quotation character (default: `"`)
 * @returns Unescaped string
 *
 * @example
 * ```typescript
 * unescapeQuotes('"hello"')         // => 'hello'
 * unescapeQuotes('""world""')       // => '"world"'
 * unescapeQuotes('"a""b""c"')       // => 'a"b"c'
 * unescapeQuotes("'test'", "'")     // => 'test'
 * ```
 */
export function unescapeQuotes(value: string, quotation = '"'): string {
  if (value.length < 2) return value;

  if (value.startsWith(quotation) && value.endsWith(quotation)) {
    const inner = value.slice(1, -1);
    const escaped = quotation + quotation;

    // Fast path: no escapes (~50% of cases)
    if (!inner.includes(escaped)) {
      return inner;
    }

    // Slow path: escapes present - process with replaceAll
    return inner.replaceAll(escaped, quotation);
  }

  return value;
}
