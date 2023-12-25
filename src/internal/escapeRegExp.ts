/**
 * Escape a string for use in a regular expression.
 *
 * @see {@link https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Regular_expressions#escaping Regular expressions#Escaping | MDN}
 * @param v string to escape
 * @returns escaped string
 */
export function escapeRegExp(v: string) {
  return v.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
