/**
 * web-csv-toolbox - Lazy CSV Architecture Types
 *
 * # 設計思想
 * - "非同期を正(Primary)"にする:
 *   Blob/Stream/File/OPFS/HTTP/Worker は本質的に非同期。
 *   そこで Public API と内部コアは Async を基準に統一し、同期入力(String/ArrayBuffer等)は
 *   「即座に解決する Async」として扱うことで使用差(分岐)を最小化する。
 *
 * - 同期APIは「最適化された限定版」:
 *   parseSync のような同期APIは、SyncByteSource + SyncIndexBackend の組み合わせでのみ提供可能。
 *   "どんな入力でも同期"はブラウザ制約上成立しないため、条件を型で明確化する。
 *
 * - I/O と実行基盤を注入可能に:
 *   アプリ要件依存(HTTP認証/帯域/OPFS運用/FS等)は ByteSource/Cache/IndexStore として外部注入し、
 *   コアは「Indexを作る」「Indexで読む」「安全に検証する」に集中する。
 *
 * - 並列/非同期結果の"帳尻"は session/epoch/chunkId で合わせる:
 *   メイン(オーケストレータ)が single source of truth。
 *   Worker は計算結果を返すだけ。受信側が検証し、順序通りにcommitする。
 *
 * - Indexデータは append-only:
 *   生成プロセス(Indexer)は stateful でもよいが、確定した Index 断片は追記のみ。
 *   これによりキャンセル/再開/部分保存(OPFS)が簡単になる。
 *
 * - ステートフルAPIは Disposable:
 *   CsvStore や ByteSource などのステートフルなリソースは明示的に破棄できる。
 *   JavaScript の Symbol.asyncDispose を使って `await using` 構文をサポート。
 */

/** 絶対オフセットは 4GB超を想定して bigint を採用 */
export type Offset64 = bigint;

/** 1フィールド < 1GB のような DoS 対策上限により、多くのケースで length は 32bit で十分 */
export type Length32 = number;

/** CSVフィールドの軽量フラグ（例: 2bit） */
export interface FieldFlags {
	/** フィールドが外側クオートで囲われている (外側の " を除去する必要がある) */
	isQuoted: boolean;
	/** フィールド内にエスケープされたクオート "" が含まれる（unescapeが必要） */
	hasEscapedQuote: boolean;
}

/** データ同一性。インデックス再利用の鍵。 */
export interface SourceIdentity {
	/** ライブラリが生成する key のベース。例: URL/ファイル識別子/OPFSパス等 */
	id: string;
	/** 任意: バイト長。分かるなら入れる（インデックス整合性検証に使う） */
	size?: Offset64;
	/** 任意: ETag 等のバージョン識別 */
	etag?: string;
	/** 任意: lastModified/mtime 等 */
	lastModifiedMs?: number;
	/** 任意: 強い同一性が必要なら hash (計算コストと相談) */
	contentHashHex?: string;
}

/**
 * 非同期を正規とする ByteSource
 * - Blob/File/OPFS/HTTP Range/Node fs などを統一
 * - ライブラリ内部は基本この型だけを見る
 * - AsyncDisposable を実装してリソース管理を可能にする
 */
export interface AsyncByteSource extends AsyncDisposable {
	/** 元データの同一性。IndexStore のキー生成や整合性検証に使用 */
	identity(): Promise<SourceIdentity>;

	/** ランダムアクセス読み取り（Range） */
	read(offset: Offset64, length: Length32): Promise<Uint8Array>;

	/**
	 * 先頭からのストリーミング読み取り（任意）
	 * - Range できないソース(純Stream)でも取り込める余地を残す
	 * - ただし Lazy random access には read が必要になることが多い
	 */
	stream?(): ReadableStream<Uint8Array>;

	/** 機能フラグ（分岐は"能力"で行い、環境依存を隔離） */
	capabilities?: {
		randomAccess: boolean; // read が実質可能か
		streaming: boolean; // stream があるか
	};
}

/**
 * 同期 ByteSource（最適化・限定）
 * - String/ArrayBuffer/Uint8Array 等の"メモリ上にすでにある"入力向け
 * - Asyncへ昇格可能 (Promise.resolve) なので、主に sync API の条件付けに使う
 * - Disposable を実装（ただし実質的には何もしないことが多い）
 */
export interface SyncByteSource extends Disposable {
	identity(): SourceIdentity;
	readSync(offset: number, length: Length32): Uint8Array; // 2^53 未満の範囲で使用する想定
}

/** ByteSource 生成補助（アプリ側で差し替え可能に） */
export type ByteSource = AsyncByteSource | SyncByteSource;

/**
 * Cache は必須にしない（性能用）。
 * - ByteSource のラッパとして実装するのが基本
 * - OPFS/IDB/メモリLRU 等、アプリ要件依存なので注入対象
 * - AsyncDisposable を実装してキャッシュのクリーンアップを可能にする
 */
export interface ByteCache extends AsyncDisposable {
	/** rangeKey は "(sourceId, offset, length)" 等、呼び出し側で決めたキー */
	get(rangeKey: string): Promise<Uint8Array | null>;
	put(rangeKey: string, bytes: Uint8Array): Promise<void>;
	/** 任意: 容量制御 */
	evict?(policy?: { maxBytes?: number; maxEntries?: number }): Promise<void>;
}

/**
 * IndexStore（永続化）
 * - OPFS/IndexedDB/Node FS/メモリ など差し替え
 * - key は source identity から生成（アプリ側の命名も許容）
 * - AsyncDisposable を実装して永続化リソースをクリーンアップ
 */
export interface IndexStore extends AsyncDisposable {
	load(key: string): Promise<IndexArtifact | null>;
	save(key: string, artifact: IndexArtifact): Promise<void>;
	delete?(key: string): Promise<void>;
}

/** DoS/堅牢性のための上限（例。プロダクト要件で調整） */
export interface Limits {
	/** フィールド最大サイズ（例: < 1GB） */
	maxFieldBytes: number;
	/** レコード(行)最大サイズ */
	maxRecordBytes: number;
	/** 行あたり最大フィールド数 */
	maxFieldsPerRecord: number;
	/** 最大行数（インデックス肥大化DoS対策） */
	maxRecords?: number;
	/** 未閉鎖クオートが続く最大長（ストリームで重要） */
	maxUnclosedQuoteBytes?: number;
}

/**
 * Index の主要構造（概念）
 * - recordStart64: レコード開始オフセット（絶対）
 * - rowMeta: 各行の fieldBlob 参照（可変長列数に対応）
 * - fieldBlob: varint(delta + flags) 等で圧縮した行内境界情報
 *
 * ここでは"保存される成果物"としての型を定義。
 * 実体のフォーマット（ヘッダ/バージョン/エンディアン等）は IndexArtifact に含める。
 */
export interface IndexCore {
	recordStart64: BigUint64Array; // または hi/lo 分割方式を採用する実装も可
	rowMeta: Uint32Array; // 例: [fieldBlobOffset, fieldCount] をパックする等。実装により変える
	fieldBlob: Uint8Array; // varint 連結
	/** 任意: レコード長を別に持つならここ */
	recordLen32?: Uint32Array;
}

/**
 * Index の保存単位
 * - バージョン/設定/limits/source identity 等をメタとして含める
 * - 読み込み時に必ず検証する（sourceとindexの不一致・破損・互換性事故を防ぐ）
 */
export interface IndexArtifact {
	formatVersion: number;
	createdAtMs: number;
	sourceIdentity: SourceIdentity;
	limits: Limits;
	core: IndexCore;

	/** 任意: ヘッダ推定結果など */
	meta?: {
		hasHeader?: boolean;
		columnCountHint?: number;
		delimiter?: number; // byte
		newline?: "LF" | "CRLF";
	};
}

/** インデックス生成中の制御ID。非同期結果の"帳尻"を合わせるために使う。 */
export interface IndexSessionId {
	sessionId: string;
	/** キャンセル→再実行の世代管理。epoch が違う結果は破棄できる */
	epoch: number;
}

/** Indexer の入力チャンク */
export interface ChunkRequest extends IndexSessionId {
	chunkId: number;
	baseOffset: Offset64; // ファイル先頭からの絶対位置
	bytes: Uint8Array; // Transferableで渡す実装も可
}

/** チャンクの要約（チャンク境界で引き継ぐ状態） */
export interface ChunkSummary {
	/** 例: チャンク内クオートのパリティなど（2-pass向け） */
	quoteParity: 0 | 1;
	/** 例: チャンク終了時点で"行の途中"か */
	endsInsideRecord: boolean;
	/** 任意: 集計/統計 */
	approxSeparators?: number;
}

/** Pass1 の局所メタ（候補境界など） */
export interface LocalChunkMeta {
	/** 実装依存: 抽出した候補位置など */
	opaque: ArrayBuffer; // 例: compact metadata
}

/** Indexer backend が返す結果（Pass1） */
export interface ChunkResult extends IndexSessionId {
	chunkId: number;
	summary: ChunkSummary;
	localMeta: LocalChunkMeta;

	/**
	 * 受信側で検証する前提:
	 * - サイズ上限
	 * - 範囲内であること
	 * - session/epoch/chunkId 整合
	 */
}

/** Pass2 で確定境界を作るための入力（prefix state 等） */
export interface FinalizeRequest extends IndexSessionId {
	chunkId: number;
	/** メインが算出した prefix 状態（例: prefix XOR 結果） */
	prefixState: ArrayBuffer;
	localMeta: LocalChunkMeta;
	baseOffset: Offset64;
	/** チャンクの生bytesが必要な場合のみ（設計次第） */
	bytes?: Uint8Array;
}

/** Pass2 の確定出力（append-only でコミットできる断片） */
export interface FinalizeResult extends IndexSessionId {
	chunkId: number;

	/**
	 * append-only 断片:
	 * - recordStart 追記分（絶対オフセット）
	 * - rowMeta 追記分
	 * - fieldBlob 追記分
	 *
	 * ※ chunkId 順に commit することで整合を保つ
	 */
	append: {
		recordStart64?: BigUint64Array;
		rowMeta?: Uint32Array;
		fieldBlob?: Uint8Array;
		recordLen32?: Uint32Array;
	};
}

/**
 * IndexBackend
 * - JS同期実装でも Promise.resolve でこの型を満たす（非同期を正規に統一）
 * - Worker/WASM 実装も同じ契約で差し替えられる
 * - AsyncDisposable を実装してWorkerなどのリソースをクリーンアップ
 */
export interface IndexBackend extends AsyncDisposable {
	submitChunk(req: ChunkRequest): Promise<ChunkResult>;
	finalizeChunk?(req: FinalizeRequest): Promise<FinalizeResult>;
}

/**
 * 同期IndexBackend（限定）
 * - "完全同期"を提供したい場合にのみ
 * - ほとんどの環境(Worker/Blob/OPFS)では提供不可
 * - Disposable を実装（ただし実質的には何もしないことが多い）
 */
export interface SyncIndexBackend extends Disposable {
	submitChunkSync(
		req: Omit<ChunkRequest, "baseOffset"> & { baseOffset: number },
	): ChunkResult;
	finalizeChunkSync?(
		req: Omit<FinalizeRequest, "baseOffset"> & { baseOffset: number },
	): FinalizeResult;
}

/** フィールド参照（遅延デコード用） */
export interface FieldRef {
	offset: Offset64;
	length: Length32;
	flags: FieldFlags;
}

/**
 * CsvStore（Stateful）
 * - 状態の真実は store 側に閉じ込める
 * - Indexerは statefulなプロセスだが、成果物(Index)は append-only として扱う
 * - AsyncDisposable を実装して明示的にリソースを解放
 *   (ByteSource, IndexBackend, IndexStore, Cache などを一括で破棄)
 */
export interface CsvStore extends AsyncDisposable {
	/** source/identity 等の情報 */
	readonly identity: SourceIdentity;

	/**
	 * インデックス構築（必要なら自動でもよいが、制御したい場合のために明示APIを持つ）
	 * - ここが重い処理（Worker/OPFS永続化など）
	 */
	buildIndex(options?: { signal?: AbortSignal }): Promise<void>;

	/**
	 * 低レベル: (row,col) -> byte range + flags
	 * - ここでは decode しない。巨大フィールドやバイナリ用途に対応。
	 */
	getFieldRef(row: number, col: number): Promise<FieldRef>;

	/**
	 * 高レベル: decode
	 * - flags により unescape をスキップできる
	 * - ただし "文字列として返す"場合は別途上限(最大文字数など)を設けるのがおすすめ
	 */
	getCell(
		row: number,
		col: number,
		opts?: { encoding?: "utf-8"; maxChars?: number },
	): Promise<string>;

	/** 行イテレーション（Stream入力でも同じ形で提供できる） */
	rows(range?: {
		from?: number;
		to?: number;
	}): AsyncIterable<{ row: number; get: (col: number) => Promise<string> }>;
}

/** CsvStore の生成オプション */
export interface CsvStoreOptions {
	source: AsyncByteSource; // 正規

	backend: IndexBackend;

	/** 任意: インデックス永続化（OPFS/IDB/FS）。なければメモリのみ */
	indexStore?: IndexStore;

	/** 任意: バイトキャッシュ。なければ source 直読み */
	cache?: ByteCache;

	/** DoS 上限 */
	limits: Limits;

	/** IndexStore key の生成戦略（アプリ都合で変更可能） */
	indexKey?: (identity: SourceIdentity) => string;
}

/**
 * 同期版生成（限定）
 * - SyncByteSource + SyncIndexBackend が揃った場合のみ提供できる
 * - それ以外は open() (async) を使う
 * - Disposable を実装
 */
export interface CsvStoreSync extends Disposable {
	readonly identity: SourceIdentity;
	buildIndexSync(): void;
	getFieldRefSync(
		row: number,
		col: number,
	): { offset: number; length: number; flags: FieldFlags };
	getCellSync(
		row: number,
		col: number,
		opts?: { encoding?: "utf-8"; maxChars?: number },
	): string;
}

export interface CsvStoreSyncOptions {
	source: SyncByteSource;
	backend: SyncIndexBackend;
	limits: Limits;
	indexStore?: never; // 同期永続は環境依存が強く、まずは非対応とする設計もあり
	cache?: never; // 同上
}

/** 工場関数（実装側で提供する想定） */
export interface CsvStoreFactory {
	open(opts: CsvStoreOptions): Promise<CsvStore>;
	openSync?(opts: CsvStoreSyncOptions): CsvStoreSync;
}
