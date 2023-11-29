import { FieldDelimiter, RecordDelimiter, Field } from './constants';
export interface Token<T extends TokenType = TokenType> {
  type: T;
  value: string;
}

export type TokenType = typeof FieldDelimiter | typeof RecordDelimiter | typeof Field;
