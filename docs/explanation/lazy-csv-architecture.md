# Lazy CSV Architecture

## 概要

Lazy CSV Architectureは、web-csv-toolboxに追加された**ステートフルなCSVストア**の設計です。従来のストリーミングAPIとは異なり、インデックスを使ったランダムアクセスと効率的なデータ読み取りを提供します。

## 設計思想

### 1. 非同期を正(Primary)にする

Blob/Stream/File/OPFS/HTTP/Workerは本質的に非同期です。Public APIと内部コアはAsync を基準に統一し、同期入力(String/ArrayBuffer等)は「即座に解決する Async」として扱うことで使用差(分岐)を最小化します。

```typescript
// 非同期が基本
await using store = await createCsvStore({
  source: createBlobByteSource(blob),
  backend: createJavaScriptIndexBackend(),
  // ...
});

// 同期入力も非同期APIで統一的に扱える
await using store2 = await createCsvStore({
  source: createStringByteSource('name,age\nAlice,30'),
  // ...
});
```

### 2. 同期APIは「最適化された限定版」

`parseSync` のような同期APIは、`SyncByteSource` + `SyncIndexBackend` の組み合わせでのみ提供可能です。「どんな入力でも同期」はブラウザ制約上成立しないため、条件を型で明確化しています。

### 3. I/O と実行基盤を注入可能に

アプリ要件依存(HTTP認証/帯域/OPFS運用/FS等)は `ByteSource`/`Cache`/`IndexStore` として外部注入し、コアは「Indexを作る」「Indexで読む」「安全に検証する」に集中します。

```typescript
// カスタムByteSource
class CustomHTTPByteSource implements AsyncByteSource {
  // 認証ヘッダーを含むHTTPリクエスト
  async read(offset: Offset64, length: Length32): Promise<Uint8Array> {
    const response = await fetch(this.url, {
      headers: {
        'Authorization': `Bearer ${this.token}`,
        'Range': `bytes=${offset}-${offset + BigInt(length) - 1n}`
      }
    });
    // ...
  }
}
```

### 4. 並列/非同期結果の"帳尻"は session/epoch/chunkId で合わせる

メイン(オーケストレータ)が single source of truth。Workerは計算結果を返すだけ。受信側が検証し、順序通りにcommitします。

### 5. Indexデータは append-only

生成プロセス(Indexer)は stateful でもよいが、確定した Index 断片は追記のみ。これによりキャンセル/再開/部分保存(OPFS)が簡単になります。

### 6. ステートフルAPIは Disposable

`CsvStore` や `ByteSource` などのステートフルなリソースは明示的に破棄できます。JavaScript の `Symbol.asyncDispose` を使って `await using` 構文をサポートします。

## アーキテクチャ図

```
┌─────────────────────────────────────────────────┐
│                  CsvStore                        │
│  (ステートフル・Disposable)                       │
│                                                  │
│  - buildIndex(): インデックス構築                │
│  - getCell(row, col): セル取得                   │
│  - rows(range): 範囲イテレーション               │
└──────┬─────────────┬──────────────┬─────────────┘
       │             │              │
       ▼             ▼              ▼
┌────────────┐ ┌────────────┐ ┌────────────┐
│ByteSource  │ │IndexBackend│ │IndexStore  │
│            │ │            │ │            │
│- identity()│ │- submitChunk()│- load()  │
│- read()    │ │- finalizeChunk()│- save()│
│- stream()  │ │            │ │            │
└────────────┘ └────────────┘ └────────────┘
       │             │              │
       ▼             ▼              ▼
  Blob/File/   JavaScript/    Memory/IDB/
  Response/    Worker/WASM     OPFS
  String
```

## 主要コンポーネント

### ByteSource

データソースの抽象化。以下の実装があります：

- **StringByteSource** (同期): メモリ上の文字列
- **BlobByteSource** (非同期): Blob/File オブジェクト
- **ResponseByteSource** (非同期): HTTP Response（Range Request対応）

```typescript
// Blob から読み取る
await using source = createBlobByteSource(blob);
const chunk = await source.read(0n, 1024);

// HTTP から読み取る（Range Request）
await using source2 = createResponseByteSource(response);
if (source2.capabilities.randomAccess) {
  const chunk = await source2.read(1000n, 2048);
}
```

### IndexBackend

インデックス生成の実装。現在は以下があります：

- **JavaScriptIndexBackend**: シングルスレッドJavaScript実装

将来的には以下が追加される予定：

- **WorkerIndexBackend**: Web Workerで並列処理
- **WASMIndexBackend**: WebAssemblyで高速処理

```typescript
await using backend = createJavaScriptIndexBackend({
  delimiter: 0x2c, // ','
  quotation: 0x22, // '"'
});
```

### IndexStore

インデックスの永続化。現在は以下があります：

- **MemoryIndexStore**: メモリ内保存（永続化なし）

将来的には以下が追加される予定：

- **IndexedDBStore**: ブラウザの IndexedDB に保存
- **OPFSStore**: Origin Private File System に保存

```typescript
await using store = createMemoryIndexStore();

// インデックスの保存
await store.save('key1', indexArtifact);

// インデックスの読み込み
const loaded = await store.load('key1');
```

## ステートレス vs ステートフル

web-csv-toolboxは2つのAPIパラダイムを提供します：

### ステートレスAPI（既存）

```typescript
import { parse } from 'web-csv-toolbox';

// 関数ベースのAPI
for await (const record of parse(csv)) {
  console.log(record);
}

// メモリ効率: O(1)
// ユースケース: 1回限りの全行スキャン
```

### ステートフルAPI（新規・Lazy）

```typescript
import { createCsvStore } from 'web-csv-toolbox/lazy';

// オブジェクトベースのAPI
await using store = await createCsvStore({ ... });
await store.buildIndex();

// ランダムアクセス
const cell = await store.getCell(1000, 5);

// メモリ効率: インデックスのサイズ（通常 O(n) だが小さい）
// ユースケース: ランダムアクセス、複数回読み取り
```

## Disposable API

Lazy CSV ArchitectureはJavaScriptの明示的リソース管理（Explicit Resource Management）をフルサポートします。

### using / await using 構文

```typescript
// 自動的にリソースを破棄
await using store = await createCsvStore({
  source: createBlobByteSource(blob),
  backend: createJavaScriptIndexBackend(),
  indexStore: createMemoryIndexStore(),
  limits: { ... }
});

await store.buildIndex();
const cell = await store.getCell(0, 0);

// ブロックを抜けると自動的に破棄される
// store[Symbol.asyncDispose]() が呼ばれる
```

### 手動破棄

```typescript
const store = await createCsvStore({ ... });

try {
  await store.buildIndex();
  const cell = await store.getCell(0, 0);
} finally {
  // 手動で破棄
  await store[Symbol.asyncDispose]();
}
```

### 複数リソースの組み合わせ

```typescript
import { combineAsyncDisposable } from 'web-csv-toolbox/lazy';

await using resources = combineAsyncDisposable(
  source,
  backend,
  indexStore
);

// すべてのリソースが自動的に破棄される
```

## インデックスフォーマット

インデックスは以下の構造で保存されます：

```typescript
interface IndexCore {
  // 各レコードの開始オフセット（バイト単位）
  recordStart64: BigUint64Array;

  // 各行のメタデータ [fieldBlobOffset, fieldCount]
  rowMeta: Uint32Array;

  // フィールド境界情報（圧縮）
  fieldBlob: Uint8Array;
}
```

## パフォーマンス特性

### メモリ使用量

- **インデックスサイズ**: 約 16 bytes/record + フィールド情報
- **例**: 100万行、10列のCSV → 約 16MB のインデックス

### ランダムアクセス

- **getCell()**: O(1) インデックス参照 + O(fieldSize) データ読み取り
- **rows(range)**: O(recordCount) インデックス参照

### インデックス構築

- **JavaScript Backend**: O(n) シングルスレッド
- **Worker Backend** (将来): O(n/cores) 並列処理

## セキュリティ

### DoS対策

```typescript
const limits: Limits = {
  maxFieldBytes: 1024 * 1024,      // 1MB/field
  maxRecordBytes: 10 * 1024 * 1024, // 10MB/record
  maxFieldsPerRecord: 1000,         // 1000 fields/record
  maxRecords: 10_000_000,           // 1000万行
};
```

### インデックス検証

保存されたインデックスは以下を検証します：

- フォーマットバージョン
- ソースID
- ソースサイズ
- ETag（HTTP Response の場合）
- Last-Modified

## 将来の拡張

### Phase 2: Worker/WASM統合

```typescript
import { createWorkerIndexBackend } from 'web-csv-toolbox/lazy';

await using backend = createWorkerIndexBackend({
  strategy: 'message-streaming', // または 'stream-transfer'
  workerPool: customPool
});
```

### Phase 3: 永続化とOPFS

```typescript
import { createOPFSIndexStore } from 'web-csv-toolbox/lazy';

await using store = createOPFSIndexStore({
  directory: 'csv-indexes'
});
```

## まとめ

Lazy CSV Architectureは以下を提供します：

✅ **ランダムアクセス**: 任意の行・列に効率的にアクセス
✅ **インデックス永続化**: 同じファイルを何度も読む場合に高速化
✅ **明示的リソース管理**: `await using` による安全なリソース破棄
✅ **プラグイン可能**: ByteSource/Backend/Storeを自由に差し替え
✅ **非同期優先**: 全てのAPIが一貫して非同期

既存のストリーミングAPIと共存し、ユースケースに応じて使い分けることができます。
