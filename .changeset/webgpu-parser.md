---
"web-csv-toolbox": minor
---

feat: WebGPU による高速CSVパーサーを追加

WebGPU を使用した並列インデックス構築により、大規模CSVファイルのパース性能が大幅に向上しました。

### 新機能

- `EnginePresets.turbo()` - GPU 優先の最高速プリセット
- `engine: { gpu: true }` オプション
- `GPUDeviceManager` / `ReusableGPUDeviceManager` - GPUデバイス管理
- GPU → WASM → JS への自動フォールバック

### 使用例

```ts
import { parseString, EnginePresets } from 'web-csv-toolbox';

// turbo プリセット (GPU → WASM → JS 自動フォールバック)
for await (const record of parseString(csv, {
  engine: EnginePresets.turbo()
})) {
  console.log(record);
}

// フォールバック通知
for await (const record of parseString(csv, {
  engine: EnginePresets.turbo({
    onFallback: (info) => console.warn(info.reason)
  })
})) {
  console.log(record);
}
```

### 対応ブラウザ

- Chrome/Edge 113+
- Firefox 121+ (要フラグ)
- Safari Technology Preview
