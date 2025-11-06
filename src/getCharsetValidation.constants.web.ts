/**
 * Commonly supported character encodings for CSV parsing in browser environments.
 *
 * @remarks
 * This list includes the most commonly used encodings that are supported across
 * all modern browsers. TextDecoder supports additional encodings, but this list
 * focuses on the most widely-used ones for CSV files.
 *
 * ### Common Character Encodings:
 * - **UTF-8**: Universal encoding, recommended for all new content
 * - **UTF-16LE/UTF-16BE**: Unicode encodings with byte order
 * - **ISO-8859-X**: Legacy single-byte encodings for Western European languages
 * - **Windows-125X**: Windows-specific legacy encodings
 * - **Shift_JIS, EUC-JP, ISO-2022-JP**: Japanese encodings
 * - **GB18030, GBK**: Chinese encodings
 * - **EUC-KR**: Korean encoding
 *
 * ### Using Non-Standard Charsets
 *
 * If you need to use a charset not in this list, you can:
 * 1. Set the `allowNonStandardCharsets` option to `true`
 * 2. Be aware that this may cause errors if the browser doesn't support the encoding
 * 3. Consider implementing fallback handling for unsupported charsets
 *
 * @example
 * ```typescript
 * // Use non-standard charset (may fail in some browsers)
 * const records = parseResponse(response, {
 *   allowNonStandardCharsets: true
 * });
 * ```
 *
 * @see {@link https://encoding.spec.whatwg.org/#names-and-labels | WHATWG Encoding Standard}
 * @see {@link https://developer.mozilla.org/en-US/docs/Web/API/TextDecoder/TextDecoder | TextDecoder}
 */
export const SUPPORTED_CHARSETS: ReadonlySet<string> = new Set([
  // UTF encodings
  "utf-8",
  "utf8",
  "unicode-1-1-utf-8",
  "utf-16le",
  "utf-16be",
  "utf-16",

  // ISO-8859 series (Western European)
  "iso-8859-1",
  "iso-8859-2",
  "iso-8859-3",
  "iso-8859-4",
  "iso-8859-5",
  "iso-8859-6",
  "iso-8859-7",
  "iso-8859-8",
  "iso-8859-9",
  "iso-8859-10",
  "iso-8859-13",
  "iso-8859-14",
  "iso-8859-15",
  "iso-8859-16",
  "latin1",

  // Windows code pages
  "windows-1250",
  "windows-1251",
  "windows-1252",
  "windows-1253",
  "windows-1254",
  "windows-1255",
  "windows-1256",
  "windows-1257",
  "windows-1258",

  // Japanese
  "shift_jis",
  "shift-jis",
  "sjis",
  "euc-jp",
  "iso-2022-jp",

  // Chinese
  "gb18030",
  "gbk",
  "gb2312",

  // Korean
  "euc-kr",

  // Other
  "ascii",
  "us-ascii",
]);
