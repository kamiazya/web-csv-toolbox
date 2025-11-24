# GPU Device Selection API

## 概要

GPU デバイス選択は、**ポリシーベース（プリファレンス）** と **カスタムストラテジー** の2つの方法をサポートしています。これらは**排他的**であり、型レベルと実行時の両方で検証されます。

## 型安全性の保証

### 1. GPUDevicePoolConfig - 排他的プロパティ

`devicePreference` と `deviceSelector` は同時に指定できません：

```typescript
// ✅ OK: devicePreference のみ
const pool1 = new ReusableGPUDevicePool({
  devicePreference: 'high-performance'
});

// ✅ OK: deviceSelector のみ
const pool2 = new ReusableGPUDevicePool({
  deviceSelector: async ({ adapters }) => adapters[0]
});

// ❌ TypeScript エラー: 両方は指定できない
const pool3 = new ReusableGPUDevicePool({
  devicePreference: 'high-performance',
  deviceSelector: async ({ adapters }) => adapters[0]  // Type Error!
});

// ✅ OK: どちらも指定しない（デフォルト: 'auto'）
const pool4 = new ReusableGPUDevicePool({
  bufferPooling: { enabled: true }
});
```

### 2. GPUInitOptions - 排他的プロパティ

`adapter` と `adapterOptions` は同時に指定できません：

```typescript
// ✅ OK: adapter のみ
const adapter = await navigator.gpu.requestAdapter();
await loadGPU({ adapter });

// ✅ OK: adapterOptions のみ
await loadGPU({
  adapterOptions: { powerPreference: 'high-performance' }
});

// ❌ TypeScript エラー: 両方は指定できない
const adapter2 = await navigator.gpu.requestAdapter();
await loadGPU({
  adapter: adapter2,
  adapterOptions: { powerPreference: 'low-power' }  // Type Error!
});

// ✅ OK: どちらも指定しない（デフォルトアダプター使用）
await loadGPU();
```

## 実行時検証

型チェックをすり抜けた場合（`any` 型使用など）でも、実行時に検証されます：

```typescript
// 実行時エラーを発生させる
try {
  const badConfig: any = {
    devicePreference: 'high-performance',
    deviceSelector: async () => null
  };
  const pool = new ReusableGPUDevicePool(badConfig);
} catch (error) {
  console.error(error.message);
  // "GPUDevicePoolConfig: Cannot specify both 'devicePreference' and 'deviceSelector'.
  //  Use either policy-based selection (devicePreference) or custom selection (deviceSelector), not both."
}

try {
  const badOptions: any = {
    adapter: await navigator.gpu.requestAdapter(),
    adapterOptions: { powerPreference: 'low-power' }
  };
  await loadGPU(badOptions);
} catch (error) {
  console.error(error.message);
  // "GPUInitOptions: Cannot specify both 'adapter' and 'adapterOptions'.
  //  Use either a custom adapter or adapter request options, not both."
}
```

## API パターン

### レベル1: 完全自動（初心者向け）

```typescript
import { ReusableGPUDevicePool, parseString } from 'web-csv-toolbox';

// 最もシンプル - すべてデフォルト
using pool = new ReusableGPUDevicePool();

await parseString(csv, {
  engine: { gpu: true, gpuDevicePool: pool }
});
```

### レベル2: ポリシーベース選択（中級者向け）

```typescript
import { ReusableGPUDevicePool, parseString } from 'web-csv-toolbox';

// devicePreference でポリシーを指定
using pool = new ReusableGPUDevicePool({
  devicePreference: 'high-performance',  // 'auto' | 'high-performance' | 'low-power' | 'balanced'
  bufferPooling: {
    enabled: true,
    maxBufferSize: 256 * 1024 * 1024  // 256MB
  }
});

await parseString(csv, {
  engine: { gpu: true, gpuDevicePool: pool }
});
```

### レベル3: カスタムストラテジー（上級者向け）

```typescript
import {
  ReusableGPUDevicePool,
  parseString,
  type GPUDeviceSelectionContext
} from 'web-csv-toolbox';

// deviceSelector でカスタムロジックを実装
using pool = new ReusableGPUDevicePool({
  deviceSelector: async ({ adapters, fileSize, expectedWorkload }: GPUDeviceSelectionContext) => {
    const infos = await Promise.all(
      adapters.map(async (adapter) => ({
        adapter,
        info: await adapter.requestAdapterInfo?.() ?? {},
      }))
    );

    // ファイルサイズに応じた選択
    if (fileSize && fileSize > 100 * 1024 * 1024) {
      // 大きいファイルは専用GPU
      const discrete = infos.find(({ info }) =>
        info.device === 'discrete-gpu'
      );
      return discrete?.adapter ?? adapters[0];
    }

    // 小さいファイルは統合GPU（省電力）
    const integrated = infos.find(({ info }) =>
      info.device === 'integrated-gpu'
    );
    return integrated?.adapter ?? adapters[0];
  },
  bufferPooling: {
    enabled: true,
    maxBufferSize: 512 * 1024 * 1024  // 512MB
  }
});

await parseString(csv, {
  engine: { gpu: true, gpuDevicePool: pool }
});
```

### レベル4: 完全手動制御（エキスパート向け）

```typescript
import { loadGPU, ReusableGPUDevicePool, parseString } from 'web-csv-toolbox';

// 手動でアダプターを取得
const adapter = await navigator.gpu.requestAdapter({
  powerPreference: 'high-performance'
});

if (!adapter) {
  throw new Error('No GPU adapter available');
}

// 手動で初期化
await loadGPU({
  adapter,
  deviceDescriptor: {
    requiredLimits: {
      maxBufferSize: 1024 * 1024 * 1024  // 1GB
    }
  }
});

// プールを作成（既に初期化済みのデバイスを使用）
using pool = new ReusableGPUDevicePool({
  bufferPooling: { enabled: true }
});

await parseString(csv, {
  engine: { gpu: true, gpuDevicePool: pool }
});
```

## プリファレンスの詳細

### `'auto'` (デフォルト)
- ブラウザに最適なデバイスを選択させる
- 最も安全で互換性が高い

### `'high-performance'`
- 専用GPU（discrete GPU）を優先
- 最高のパフォーマンス
- 消費電力は高い
- 大きなファイル（>100MB）に最適

### `'low-power'`
- 統合GPU（integrated GPU）を優先
- 省電力
- パフォーマンスは劣る
- モバイルデバイスやバッテリー駆動時に最適

### `'balanced'`
- パフォーマンスと電力のバランス
- 中程度のファイルサイズに最適

## バッファプーリング

デバイスとバッファをセットでプールすることで、GPU メモリアロケーションのオーバーヘッドを削減：

```typescript
const pool = new ReusableGPUDevicePool({
  devicePreference: 'high-performance',
  bufferPooling: {
    enabled: true,
    maxBufferSize: 256 * 1024 * 1024,      // 256MB まで
    preallocateSize: 64 * 1024 * 1024      // 64MB を事前確保（オプション）
  }
});
```

### バッファプーリングのメリット

- ✅ GPU バッファの作成/破棄のオーバーヘッド削減
- ✅ 連続した parse 操作で高速化
- ✅ メモリの効率的な再利用

### バッファプーリングのトレードオフ

- ⚠️ メモリ使用量が増加する可能性
- ⚠️ 長時間使わないバッファがメモリに残る

## まとめ

| 機能 | 型安全性 | 実行時検証 | 用途 |
|------|---------|-----------|------|
| `devicePreference` vs `deviceSelector` | ✅ | ✅ | 排他的選択 |
| `adapter` vs `adapterOptions` | ✅ | ✅ | 排他的選択 |
| Buffer pooling | ✅ | - | 性能最適化 |

これにより、ユーザーは段階的に学習しながら、必要に応じて高度な制御が可能になります。
