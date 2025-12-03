/**
 * CSV Separator Indexer Module
 *
 * This module provides streaming-aware CSV separator indexing with backend abstraction.
 * The primary use case is large file processing where data arrives in chunks.
 *
 * @example
 * ```typescript
 * import {
 *   CSVSeparatorIndexer,
 *   WASMIndexerBackend,
 * } from 'web-csv-toolbox/parser/indexer';
 *
 * // Create and initialize backend
 * const backend = new WASMIndexerBackend(44); // comma delimiter
 * await backend.initialize();
 *
 * // Create indexer
 * const indexer = new CSVSeparatorIndexer(backend);
 *
 * // Process chunks
 * for await (const chunk of stream) {
 *   const result = indexer.index(chunk, { stream: true });
 *   // Process separators up to result.sepCount
 * }
 *
 * // Flush remaining data
 * const final = indexer.index();
 * ```
 */

export {
  type CSVIndexerBackendSync,
  CSVSeparatorIndexer,
  type CSVSeparatorIndexerOptions,
} from "./CSVSeparatorIndexer.ts";

export { WASMIndexerBackend } from "./WASMIndexerBackend.ts";
