/**
 * GPU Token Utilities for Testing
 *
 * Provides utilities for normalizing and converting GPU tokens to comparable formats
 * for use in property-based tests and other GPU-related test scenarios.
 */

import type { Token } from "@/core/types.ts";
import type { GPUToken } from "@/parser/webgpu/assembly/separatorsToTokens.ts";

/**
 * Normalized token format for comparison
 */
export interface NormalizedToken {
  /**
   * Token type:
   * - 0: Field (TokenType.Field)
   * - 2: RecordDelimiter (TokenType.RecordDelimiter)
   */
  type: number;

  /**
   * Token value (field content)
   */
  value: string;
}

/**
 * Convert GPUToken stream to Token-like format
 *
 * GPUToken format: Field (type=0) + FieldDelimiter (type=1) or RecordDelimiter (type=2)
 * Token format: Field with delimiter info included
 *
 * This function merges consecutive GPUTokens into a single token format for comparison
 * with other lexer implementations.
 *
 * @param gpuTokens - Array of GPU tokens to convert
 * @returns Array of normalized tokens
 *
 * @example
 * ```typescript
 * const gpuTokens = [
 *   { type: 0, value: "Alice" },   // Field
 *   { type: 1, value: "" },        // FieldDelimiter
 *   { type: 0, value: "30" },      // Field
 *   { type: 2, value: "" }         // RecordDelimiter
 * ];
 *
 * const normalized = convertGPUTokensToTokenFormat(gpuTokens);
 * // Returns: [
 * //   { type: 0, value: "Alice" },
 * //   { type: 2, value: "30" }
 * // ]
 * ```
 */
export function convertGPUTokensToTokenFormat(
  gpuTokens: Array<{ type: number; value: string }>,
): NormalizedToken[] {
  const result: NormalizedToken[] = [];
  let i = 0;

  while (i < gpuTokens.length) {
    const current = gpuTokens[i];
    if (!current) break; // Safety check

    if (current.type === 0) {
      // Field token
      const nextToken = gpuTokens[i + 1];
      if (nextToken?.type === 1) {
        // Field followed by FieldDelimiter - merge them but keep field type
        result.push({
          type: 0, // TokenType.Field
          value: current.value,
        });
        i += 2; // Skip both Field and FieldDelimiter
      } else if (nextToken?.type === 2) {
        // Field followed by RecordDelimiter
        result.push({
          type: 2, // TokenType.RecordDelimiter
          value: current.value,
        });
        i += 2; // Skip both Field and RecordDelimiter
      } else {
        // Field without delimiter (last field in stream)
        // WASM lexer marks last field as RecordDelimiter
        result.push({
          type: 2, // TokenType.RecordDelimiter
          value: current.value,
        });
        i++;
      }
    } else {
      // Delimiter without preceding field (shouldn't happen in valid CSV)
      result.push(current);
      i++;
    }
  }

  return result;
}

/**
 * Convert Token to comparable format (normalize types)
 *
 * Maps different token representations to a unified format:
 * - Token with `type` field: Use as-is
 * - Token with `delimiter` field: Map Delimiter enum to TokenType enum
 *   - Delimiter.Field (0) -> TokenType.Field (0)
 *   - Delimiter.Record (1) -> TokenType.RecordDelimiter (2)
 *
 * @param token - Token to normalize (supports multiple token formats)
 * @returns Normalized token with type and value fields
 * @throws {Error} If token structure is invalid
 *
 * @example
 * ```typescript
 * // Token with type field
 * const token1 = normalizeToken({ type: 0, value: "Alice" });
 * // Returns: { type: 0, value: "Alice" }
 *
 * // Token with delimiter field
 * const token2 = normalizeToken({ delimiter: 1, value: "Bob" });
 * // Returns: { type: 2, value: "Bob" }
 * ```
 */
export function normalizeToken(
  token:
    | Token
    | GPUToken
    | { type: number; value: string }
    | { delimiter: number; value: string },
): NormalizedToken {
  if ("type" in token && "value" in token) {
    return {
      type: token.type,
      value: token.value,
    };
  }
  if ("delimiter" in token && "value" in token) {
    // Map Delimiter enum to TokenType enum
    // Delimiter.Field (0) -> TokenType.Field (0)
    // Delimiter.Record (1) -> TokenType.RecordDelimiter (2)
    const type = token.delimiter === 0 ? 0 : 2;
    return {
      type,
      value: token.value,
    };
  }
  throw new Error(`Invalid token structure: ${JSON.stringify(token)}`);
}
