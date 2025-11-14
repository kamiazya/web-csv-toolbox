/**
 * Supported compression formats for CSV decompression in browser environments.
 *
 * @remarks
 * By default, only universally supported compression formats (gzip and deflate) are included
 * to ensure cross-browser compatibility. These formats are part of the standard Compression
 * Streams API and work reliably across all modern browsers (Chrome, Firefox, Safari, Edge).
 *
 * ### Experimental Compression Support
 *
 * Additional compression formats like `deflate-raw` may be supported in some browsers
 * (e.g., Chromium-based browsers such as Chrome and Edge), but are not guaranteed to work
 * across all environments. To use experimental compression formats:
 *
 * 1. Set the `allowExperimentalCompressions` option to `true` in your parse function
 * 2. Be aware that this may cause errors in browsers that don't support the format
 * 3. Consider implementing fallback handling for unsupported formats
 *
 * @example
 * ```typescript
 * // Use experimental compressions (may fail in some browsers)
 * const records = parseResponse(response, {
 *   allowExperimentalCompressions: true
 * });
 * ```
 *
 * @see {@link https://developer.mozilla.org/en-US/docs/Web/API/CompressionFormat | CompressionFormat}
 * @see {@link https://developer.mozilla.org/en-US/docs/Web/API/DecompressionStream | DecompressionStream}
 */
export const SUPPORTED_COMPRESSIONS: ReadonlySet<CompressionFormat> = new Set([
  "gzip",
  "deflate",
]);
