/**
 * Default String CSV Lexer.
 *
 * @remarks
 * This is an alias for {@link FlexibleStringCSVLexer}, which is the recommended
 * default implementation for string-based CSV lexing. It provides a good balance
 * between performance and memory efficiency.
 *
 * @example
 * ```typescript
 * import { DefaultStringCSVLexer } from 'web-csv-toolbox';
 *
 * const lexer = new DefaultStringCSVLexer({ delimiter: ',', quotation: '"' });
 * for (const token of lexer.lex('name,age\nAlice,30')) {
 *   console.log(token);
 * }
 * ```
 */
export { FlexibleStringCSVLexer as DefaultStringCSVLexer } from "./FlexibleStringCSVLexer.ts";
