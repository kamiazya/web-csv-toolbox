import type { ColumnCountStrategy } from "@/core/types.ts";

/**
 * Validates that the columnCountStrategy is valid for object format.
 *
 * Object format assemblers do not support "keep" strategy because
 * object format always maps values to header keys.
 *
 * @param strategy - The column count strategy to validate.
 * @throws {TypeError} If strategy is "keep" (not supported for object format).
 *
 * @example
 * ```typescript
 * validateColumnCountStrategyForObject("pad"); // OK
 * validateColumnCountStrategyForObject("truncate"); // OK
 * validateColumnCountStrategyForObject("strict"); // OK
 * validateColumnCountStrategyForObject("keep"); // throws TypeError
 * ```
 */
export function validateColumnCountStrategyForObject(
  strategy: ColumnCountStrategy,
): void {
  if (strategy === "keep") {
    throw new TypeError(
      `columnCountStrategy 'keep' is not supported for object format. ` +
        `Object format always maps to header keys. ` +
        `Use 'pad' (default), 'truncate', or 'strict' instead.`,
    );
  }
}
