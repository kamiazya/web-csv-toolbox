/**
 * Commonly supported character encodings for CSV parsing in Node.js environments.
 *
 * @remarks
 * Node.js 20+ supports the WHATWG Encoding Standard through TextDecoder.
 * This list includes the most commonly used encodings for CSV files.
 *
 * @see {@link https://nodejs.org/api/util.html#class-utiltextdecoder | Node.js TextDecoder}
 * @see {@link https://encoding.spec.whatwg.org/#names-and-labels | WHATWG Encoding Standard}
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
