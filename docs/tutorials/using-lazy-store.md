# Lazy Store の使い方

このチュートリアルでは、Lazy CSV Architecture を使ったステートフルなCSVストアの基本的な使い方を学びます。

## 目次

- [基本的な使い方](#基本的な使い方)
- [様々なデータソース](#様々なデータソース)
- [ランダムアクセス](#ランダムアクセス)
- [範囲イテレーション](#範囲イテレーション)
- [インデックスの永続化](#インデックスの永続化)
- [リソース管理](#リソース管理)

## 基本的な使い方

### インストール

```bash
npm install web-csv-toolbox
```

### 最小限の例

```typescript
import {
  createCsvStore,
  createBlobByteSource,
  createJavaScriptIndexBackend,
  createMemoryIndexStore,
} from 'web-csv-toolbox/lazy';

// FileInputからFileオブジェクトを取得
const fileInput = document.querySelector<HTMLInputElement>('input[type="file"]');
const file = fileInput.files[0];

// CsvStoreを作成
await using store = await createCsvStore({
  source: createBlobByteSource(file),
  backend: createJavaScriptIndexBackend(),
  indexStore: createMemoryIndexStore(),
  limits: {
    maxFieldBytes: 1024 * 1024,       // 1MB/field
    maxRecordBytes: 10 * 1024 * 1024, // 10MB/record
    maxFieldsPerRecord: 1000,
  }
});

// インデックスを構築
await store.buildIndex();

// セルにアクセス
const cell = await store.getCell(0, 0); // 1行目、1列目
console.log(cell); // "Alice"

// 自動的にリソースが破棄される（await usingのおかげ）
```

## 様々なデータソース

### 1. Blob/File

```typescript
import { createBlobByteSource } from 'web-csv-toolbox/lazy';

// File オブジェクトから
const file = document.querySelector('input[type="file"]').files[0];
await using source = createBlobByteSource(file);

// Blob オブジェクトから
const blob = new Blob(['name,age\nAlice,30'], { type: 'text/csv' });
await using source2 = createBlobByteSource(blob);
```

### 2. HTTP Response

```typescript
import { createResponseByteSource } from 'web-csv-toolbox/lazy';

const response = await fetch('https://example.com/data.csv');
await using source = createResponseByteSource(response);

// Range Request がサポートされているかチェック
if (source.capabilities.randomAccess) {
  console.log('ランダムアクセス可能！');
  const chunk = await source.read(0n, 1024);
} else {
  console.log('ストリーミングのみ');
  const stream = source.stream();
}
```

### 3. 文字列

```typescript
import { createStringByteSource } from 'web-csv-toolbox/lazy';

const csv = `name,age
Alice,30
Bob,25`;

using source = createStringByteSource(csv);
const identity = source.identity();
const chunk = source.readSync(0, 100);
```

### 4. URLから直接

```typescript
import { createURLByteSource } from 'web-csv-toolbox/lazy';

await using source = await createURLByteSource('https://example.com/data.csv', {
  fetchOptions: {
    headers: {
      'Authorization': 'Bearer YOUR_TOKEN'
    }
  }
});
```

## ランダムアクセス

### 特定のセルを取得

```typescript
await using store = await createCsvStore({ ... });
await store.buildIndex();

// 行番号、列番号でアクセス（0-indexed）
const cell1 = await store.getCell(0, 0);  // 1行目、1列目
const cell2 = await store.getCell(999, 5); // 1000行目、6列目

console.log(cell1, cell2);
```

### フィールド参照を取得（低レベルAPI）

```typescript
// フィールドのバイト位置を取得
const fieldRef = await store.getFieldRef(100, 3);

console.log(fieldRef);
// {
//   offset: 12345n,
//   length: 42,
//   flags: {
//     isQuoted: true,
//     hasEscapedQuote: false
//   }
// }

// 自分でデコードする場合
const bytes = await store.source.read(fieldRef.offset, fieldRef.length);
const decoder = new TextDecoder();
const text = decoder.decode(bytes);
```

### エンコーディング指定

```typescript
// UTF-8以外のエンコーディング
const cell = await store.getCell(0, 0, {
  encoding: 'shift-jis',  // Shift-JIS
  maxChars: 1000          // 最大1000文字
});
```

## 範囲イテレーション

### 全行をイテレート

```typescript
await using store = await createCsvStore({ ... });
await store.buildIndex();

for await (const row of store.rows()) {
  const name = await row.get(0);
  const age = await row.get(1);
  console.log(`${name}: ${age}歳`);
}
```

### 範囲を指定してイテレート

```typescript
// 100行目から200行目まで
for await (const row of store.rows({ from: 100, to: 200 })) {
  console.log(`Row ${row.row}:`, await row.get(0));
}

// 最初の10行
for await (const row of store.rows({ to: 10 })) {
  console.log(await row.get(0));
}

// 1000行目以降
for await (const row of store.rows({ from: 1000 })) {
  console.log(await row.get(0));
}
```

### ページネーション

```typescript
const pageSize = 100;
const page = 5; // 6ページ目（0-indexed）

for await (const row of store.rows({
  from: page * pageSize,
  to: (page + 1) * pageSize
})) {
  // 500行目〜599行目を処理
  console.log(await row.get(0));
}
```

## インデックスの永続化

### メモリストア（デフォルト）

```typescript
import { createMemoryIndexStore } from 'web-csv-toolbox/lazy';

// インデックスはメモリにのみ保存（ページリロードで消える）
await using indexStore = createMemoryIndexStore();

await using store = await createCsvStore({
  source,
  backend,
  indexStore,  // メモリストア
  limits
});
```

### カスタムインデックスキー

```typescript
await using store = await createCsvStore({
  source,
  backend,
  indexStore,
  limits,
  // カスタムキー生成関数
  indexKey: (identity) => `my-app:csv-index:${identity.id}:${identity.etag}`
});
```

### インデックスの手動管理

```typescript
import { createMemoryIndexStore } from 'web-csv-toolbox/lazy';

await using indexStore = createMemoryIndexStore();

// インデックスの保存
const artifact: IndexArtifact = {
  formatVersion: 1,
  createdAtMs: Date.now(),
  sourceIdentity,
  limits,
  core: indexCore
};
await indexStore.save('my-key', artifact);

// インデックスの読み込み
const loaded = await indexStore.load('my-key');
if (loaded) {
  console.log('インデックスが見つかりました');
}

// インデックスの削除
await indexStore.delete('my-key');
```

## リソース管理

### await using 構文（推奨）

```typescript
// 自動的にリソースを破棄
await using store = await createCsvStore({ ... });

await store.buildIndex();
const cell = await store.getCell(0, 0);

// ブロックを抜けると自動的に破棄される
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

### 複数リソースの管理

```typescript
import { combineAsyncDisposable } from 'web-csv-toolbox/lazy';

const source = createBlobByteSource(blob);
const backend = createJavaScriptIndexBackend();
const indexStore = createMemoryIndexStore();

// 複数のリソースを組み合わせる
await using resources = combineAsyncDisposable(
  source,
  backend,
  indexStore
);

// すべてのリソースが自動的に破棄される
```

## 高度な使い方

### AbortSignal によるキャンセル

```typescript
const controller = new AbortController();

await using store = await createCsvStore({ ... });

try {
  // インデックス構築をキャンセル可能にする
  await store.buildIndex({ signal: controller.signal });
} catch (error) {
  if (error instanceof DOMException && error.name === 'AbortError') {
    console.log('インデックス構築がキャンセルされました');
  }
}

// キャンセル
controller.abort();
```

### プログレス表示

```typescript
// 簡易的なプログレス表示（将来的にはprogressイベントをサポート予定）
await using store = await createCsvStore({ ... });

console.log('インデックス構築中...');
const startTime = Date.now();

await store.buildIndex();

const duration = Date.now() - startTime;
console.log(`完了！（${duration}ms）`);
```

### エラーハンドリング

```typescript
try {
  await using store = await createCsvStore({
    source: createBlobByteSource(blob),
    backend: createJavaScriptIndexBackend(),
    indexStore: createMemoryIndexStore(),
    limits: {
      maxFieldBytes: 1024 * 1024,
      maxRecordBytes: 10 * 1024 * 1024,
      maxFieldsPerRecord: 1000,
    }
  });

  await store.buildIndex();

  const cell = await store.getCell(0, 0);
  console.log(cell);

} catch (error) {
  if (error instanceof RangeError) {
    console.error('範囲外アクセス:', error.message);
  } else if (error instanceof DOMException) {
    console.error('DOM例外:', error.message);
  } else {
    console.error('予期しないエラー:', error);
  }
}
```

## 実用例

### テーブルUIへの統合

```typescript
import {
  createCsvStore,
  createBlobByteSource,
  createJavaScriptIndexBackend,
  createMemoryIndexStore,
} from 'web-csv-toolbox/lazy';

class CsvTableView {
  private store: CsvStore | null = null;

  async loadFile(file: File) {
    // 既存のストアを破棄
    if (this.store) {
      await this.store[Symbol.asyncDispose]();
    }

    // 新しいストアを作成
    this.store = await createCsvStore({
      source: createBlobByteSource(file),
      backend: createJavaScriptIndexBackend(),
      indexStore: createMemoryIndexStore(),
      limits: {
        maxFieldBytes: 1024 * 1024,
        maxRecordBytes: 10 * 1024 * 1024,
        maxFieldsPerRecord: 1000,
      }
    });

    await this.store.buildIndex();
  }

  async renderPage(page: number, pageSize: number = 100) {
    if (!this.store) throw new Error('No file loaded');

    const rows: string[][] = [];

    for await (const row of this.store.rows({
      from: page * pageSize,
      to: (page + 1) * pageSize
    })) {
      const rowData: string[] = [];
      // 各列を取得（列数は固定と仮定）
      for (let col = 0; col < 10; col++) {
        try {
          rowData.push(await row.get(col));
        } catch {
          rowData.push(''); // 列が存在しない場合
        }
      }
      rows.push(rowData);
    }

    return rows;
  }

  async dispose() {
    if (this.store) {
      await this.store[Symbol.asyncDispose]();
      this.store = null;
    }
  }
}

// 使用例
const tableView = new CsvTableView();
await tableView.loadFile(file);
const page1 = await tableView.renderPage(0); // 最初の100行
const page2 = await tableView.renderPage(1); // 次の100行
await tableView.dispose();
```

## まとめ

Lazy Store を使うと以下が可能になります：

✅ **ランダムアクセス**: 任意の行・列に直接アクセス
✅ **効率的なイテレーション**: 必要な範囲だけを読み取り
✅ **インデックス永続化**: 同じファイルを何度も読む場合に高速化
✅ **明示的リソース管理**: `await using` による安全なリソース破棄

従来のストリーミングAPIと組み合わせて、用途に応じて使い分けることができます。

## 次のステップ

- [Lazy CSV Architecture の詳細](../explanation/lazy-csv-architecture.md)
- [カスタムByteSource の実装](../how-to-guides/custom-byte-source.md)（準備中）
- [Worker並列処理](../how-to-guides/worker-indexing.md)（準備中）
