import { Field, FieldDelimiter, RecordDelimiter } from "@/common/constants.js";
export interface Token<T extends TokenType = TokenType> {
  type: T;
  value: string;
}

export type TokenType =
  | typeof FieldDelimiter
  | typeof RecordDelimiter
  | typeof Field;
