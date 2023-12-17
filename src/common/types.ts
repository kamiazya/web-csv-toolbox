import { Field, FieldDelimiter, RecordDelimiter } from "./constants.js";

/**
 * Token is a atomic unit of a CSV file.
 * It can be a field, field delimiter, or record delimiter.
 *
 * @example
 * ```ts
 * const fieldToken: Token = { type: Field, value: "foo" };
 * const fieldDelimiterToken: Token = { type: FieldDelimiter, value: "," };
 * const recordDelimiterToken: Token = { type: RecordDelimiter, value: "\n" };
 * ```
 */
export interface Token<T extends TokenType = TokenType> {
  type: T;
  value: string;
}

/**
 * Type of a token for CSV.
 */
export type TokenType =
  | typeof FieldDelimiter
  | typeof RecordDelimiter
  | typeof Field;
