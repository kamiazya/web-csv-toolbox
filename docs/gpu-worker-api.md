# GPU Worker API

## 概要

このドキュメントでは、Worker 環境での WebGPU パーサーの使用方法について説明します。

## 制約事項

### 関数は Worker に転送できない

JavaScript の `postMessage` API の制約により、以下のものは Worker に転送できません：

- **関数**（`deviceSelector` などのカスタムストラテジー）
- **クロージャー**（外部スコープの変数を参照する関数）
- **オブジェクトインスタンス**（`GPUDeviceManager`, `GPUAdapter` など）

転送できるのは、**構造化クローン可能なデータ**のみです：
- プリミティブ値（文字列、数値、真偽値）
- プレーンオブジェクト
- 配列
- 一部の組み込み型（`Date`, `RegExp`, `Map`, `Set` など）

## API レベル

### 高レベル API（メインスレッド → Worker）

メインスレッドから Worker に GPU 設定を渡す場合、**ポリシーベースの選択**のみがサポートされます。

#### 使用可能な設定

```typescript
import { parseString } from 'web-csv-toolbox';

await parseString(csv, {
  engine: {
    worker: true,
    gpu: true,
    gpuOptions: {
      // ✅ ポリシーベースの選択（文字列なので転送可能）
      devicePreference: 'high-performance',

      // ✅ WebGPU 標準オプション（プレーンオブジェクトなので転送可能）
      adapterOptions: {
        powerPreference: 'high-performance'
      },

      // ✅ デバイス記述子（プレーンオブジェクトなので転送可能）
      deviceDescriptor: {
        requiredFeatures: ['shader-f16'] as GPUFeatureName[]
      }
    }
  }
});
```

#### 使用できない設定

```typescript
// ❌ カスタムストラテジー（関数は転送不可）
await parseString(csv, {
  engine: {
    worker: true,
    gpu: true,
    gpuDeviceManager: new ReusableGPUDeviceManager({
      deviceSelector: async ({ adapters }) => {
        // この関数は Worker に転送できない
        return adapters[0];
      }
    })
  }
});
```

### 低レベル API（Worker 内部）

Worker コード内で直接 `GPUDeviceManager` を使用する場合、**完全なカスタマイズ性**が利用できます。

#### カスタム Worker の実装

```typescript
// custom-worker.ts
import {
  ReusableGPUDeviceManager,
  type GPUDeviceSelectionContext
} from 'web-csv-toolbox';

// ✅ Worker 内部では関数を直接定義できる（転送不要）
const manager = new ReusableGPUDeviceManager({
  deviceSelector: async ({ adapters, fileSize }: GPUDeviceSelectionContext) => {
    // カスタムロジック
    if (fileSize && fileSize > 10_000_000) {
      // 大きなファイルには高性能 GPU を使用
      const highPerf = adapters.find(a =>
        a.isFallbackAdapter === false
      );
      return highPerf || adapters[0];
    }
    return adapters[0];
  },

  // クロージャーも使用可能
  initOptions: {
    deviceDescriptor: {
      label: `Worker GPU Device ${Date.now()}`
    }
  }
});

// Worker のメッセージハンドラーで使用
self.addEventListener('message', async (event) => {
  const device = await manager.getDevice();
  // GPU を使った処理...
  manager.releaseDevice();
});
```

#### カスタム Worker の使用

```typescript
// main.ts
import { parseString } from 'web-csv-toolbox';

await parseString(csv, {
  engine: {
    worker: true,
    workerURL: new URL('./custom-worker.ts', import.meta.url)
  }
});
```

## 推奨パターン

### パターン 1: メインスレッドのみで GPU 使用

最もシンプルなアプローチ。カスタムストラテジーも使用可能。

```typescript
import { ReusableGPUDeviceManager, parseString } from 'web-csv-toolbox';

using manager = new ReusableGPUDeviceManager({
  // ✅ カスタムストラテジー（メインスレッドなので使用可能）
  deviceSelector: async ({ adapters, fileSize }) => {
    return fileSize > 10_000_000 ? adapters[0] : adapters[1];
  }
});

await parseString(csv, {
  engine: {
    gpu: true,
    gpuDeviceManager: manager
  }
});
```

### パターン 2: Worker で GPU 使用（ポリシーベース）

Worker で並列処理しつつ、GPU も使用する。設定はポリシーベースのみ。

```typescript
import { parseString } from 'web-csv-toolbox';

await parseString(csv, {
  engine: {
    worker: true,
    gpu: true,
    gpuOptions: {
      devicePreference: 'high-performance'
    }
  }
});
```

### パターン 3: カスタム Worker で GPU 使用（フルカスタマイズ）

Worker 内で直接 GPU を制御する。完全なカスタマイズ性。

```typescript
// custom-worker.ts
import { ReusableGPUDeviceManager } from 'web-csv-toolbox';

const manager = new ReusableGPUDeviceManager({
  deviceSelector: customLogic // ✅ Worker 内部なので関数使用可能
});

// main.ts
import { parseString } from 'web-csv-toolbox';

await parseString(csv, {
  engine: {
    worker: true,
    workerURL: new URL('./custom-worker.ts', import.meta.url)
  }
});
```

### パターン 4: Worker と WASM のハイブリッド

GPU が使えない環境では WASM にフォールバック。

```typescript
import { parseString } from 'web-csv-toolbox';

await parseString(csv, {
  engine: {
    worker: true,
    gpu: true,      // GPU を試す
    wasm: true,     // 使えなければ WASM
    gpuOptions: {
      devicePreference: 'high-performance'
    },
    onFallback: (info) => {
      console.warn(`GPU unavailable: ${info.reason}, using ${info.actualConfig.wasm ? 'WASM' : 'JS'}`);
    }
  }
});
```

## API リファレンス

### `SerializableGPUOptions`

Worker に転送可能な GPU オプション。

```typescript
interface SerializableGPUOptions {
  /**
   * ポリシーベースのデバイス選択
   * @default "auto"
   */
  devicePreference?: 'auto' | 'high-performance' | 'low-power' | 'balanced';

  /**
   * アダプターリクエストオプション
   */
  adapterOptions?: GPURequestAdapterOptions;

  /**
   * デバイス記述子
   */
  deviceDescriptor?: GPUDeviceDescriptor;
}
```

### `GPUDevicePreference`

ポリシーベースのデバイス選択。

- **`auto`**: ブラウザのデフォルト選択
- **`high-performance`**: 高性能 GPU を優先（discrete GPU）
- **`low-power`**: 省電力 GPU を優先（integrated GPU）
- **`balanced`**: パフォーマンスと電力のバランス

## よくある質問

### Q: Worker で `deviceSelector` を使用できますか？

**A**: メインスレッドから Worker に渡すことはできません（関数は転送不可）。ただし、Worker コード内で直接定義することは可能です。

### Q: Worker と GPU を同時に使用するメリットは？

**A**:
- **Worker**: メインスレッドをブロックせずに並列処理
- **GPU**: Worker 内での CSV パース処理を GPU で高速化

大きなファイルの処理では、両方を組み合わせることで最大のパフォーマンスを得られます。

### Q: `gpuDeviceManager` と `gpuOptions` の違いは？

**A**:
- **`gpuDeviceManager`**: メインスレッド専用。完全なカスタマイズ性（関数、オブジェクトインスタンス）
- **`gpuOptions`**: Worker に転送可能。ポリシーベースの設定のみ（文字列、プレーンオブジェクト）

### Q: GPU が使えない環境ではどうなりますか？

**A**: `engine.onFallback` コールバックが呼ばれ、WASM（有効な場合）または JavaScript にフォールバックします。

## 実装状況

### ✅ 完了
- `SerializableGPUOptions` 型定義
- `BaseEngineConfig` への `gpuOptions` 追加
- `serializeOptions` での GPU オプションの転送サポート
- ドキュメント整備

### 🚧 計画中
- Worker での GPU 実行パスの統合
- GPU + Worker の自動ディスパッチ
- パフォーマンスベンチマーク

## 関連ドキュメント

- [WebGPU Parser](../src/parser/webgpu/README.md)
- [GPU Device Selection API](../GPU_DEVICE_SELECTION_API.md)
- [Engine Configuration](./engine-config.md)
