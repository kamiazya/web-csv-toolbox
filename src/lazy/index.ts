/**
 * web-csv-toolbox/lazy
 *
 * Lazy CSV Architecture API
 *
 * ステートフルなCsvStoreを使ったインデックスベースのランダムアクセスCSV処理
 *
 * @example
 * ```typescript
 * import {
 *   createCsvStore,
 *   createBlobByteSource,
 *   createJavaScriptIndexBackend,
 *   createMemoryIndexStore,
 * } from 'web-csv-toolbox/lazy';
 *
 * await using store = await createCsvStore({
 *   source: createBlobByteSource(blob),
 *   backend: createJavaScriptIndexBackend(),
 *   indexStore: createMemoryIndexStore(),
 *   limits: {
 *     maxFieldBytes: 1024 * 1024,
 *     maxRecordBytes: 10 * 1024 * 1024,
 *     maxFieldsPerRecord: 1000,
 *   }
 * });
 *
 * await store.buildIndex();
 *
 * // ランダムアクセス
 * const cell = await store.getCell(1000, 5);
 *
 * // 範囲イテレーション
 * for await (const row of store.rows({ from: 100, to: 200 })) {
 *   const value = await row.get(0);
 *   console.log(value);
 * }
 * ```
 */

// Core types
export type {
	AsyncByteSource,
	ByteCache,
	ByteSource,
	ChunkRequest,
	ChunkResult,
	ChunkSummary,
	CsvStore,
	CsvStoreFactory,
	CsvStoreOptions,
	CsvStoreSync,
	CsvStoreSyncOptions,
	FieldFlags,
	FieldRef,
	FinalizeRequest,
	FinalizeResult,
	IndexArtifact,
	IndexBackend,
	IndexCore,
	IndexSessionId,
	IndexStore,
	Length32,
	Limits,
	LocalChunkMeta,
	Offset64,
	SourceIdentity,
	SyncByteSource,
	SyncIndexBackend,
} from "./types.js";

// CsvStore
export { CsvStoreFactory, CsvStoreImpl, createCsvStore } from "./CsvStore.js";

// ByteSources
export {
	BlobByteSource,
	createBlobByteSource,
	createFileByteSource,
} from "./sources/BlobByteSource.js";
export {
	ResponseByteSource,
	createResponseByteSource,
	createURLByteSource,
} from "./sources/ResponseByteSource.js";
export {
	StringByteSource,
	createStringByteSource,
} from "./sources/StringByteSource.js";

// IndexBackends
export {
	JavaScriptIndexBackend,
	createJavaScriptIndexBackend,
	type JavaScriptIndexBackendOptions,
} from "./backends/JavaScriptIndexBackend.js";

// IndexStores
export {
	MemoryIndexStore,
	createMemoryIndexStore,
} from "./stores/MemoryIndexStore.js";

// Utilities
export {
	combineAsyncDisposable,
	combineDisposable,
	createAsyncDisposable,
	createDisposable,
	noopAsyncDisposable,
	noopDisposable,
} from "./utils/disposable.js";
