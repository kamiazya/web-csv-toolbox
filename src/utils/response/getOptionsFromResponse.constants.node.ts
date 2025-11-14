/**
 * Supported compression formats for CSV decompression in Node.js environments.
 *
 * @remarks
 * Node.js 20+ supports gzip and deflate via the Compression Streams API.
 * deflate-raw may not be reliably supported in all Node.js versions.
 *
 * @see {@link https://nodejs.org/api/webstreams.html#compressionstream | Node.js CompressionStream}
 */
export const SUPPORTED_COMPRESSIONS: ReadonlySet<CompressionFormat> = new Set([
  "gzip",
  "deflate",
  // Note: deflate-raw is not included as it may not be supported in Node.js 20
]);
