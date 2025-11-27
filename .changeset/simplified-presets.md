---
"web-csv-toolbox": minor
---

refactor: EnginePresets を3つのシンプルなプリセットに整理

### 破壊的変更

#### 削除されたプリセット

- `EnginePresets.balanced()` → `EnginePresets.recommended()` を使用
- `EnginePresets.fastest()` → `EnginePresets.turbo()` を使用
- `EnginePresets.responsiveParsing()` → `EnginePresets.recommended()` を使用
- `EnginePresets.lowMemory()` → `EnginePresets.stable()` を使用
- `EnginePresets.optimizedWASM()` → `EnginePresets.recommended()` を使用

#### 削除された型

- `StringCSVLexer` → `SyncStringCSVLexer` を使用
- `BinaryCSVLexer` → `SyncBinaryCSVLexer` を使用
- `EnginePresetOptions` → `PresetOptions` を使用
- `MainThreadPresetOptions` → `PresetOptions` を使用
- `WorkerPresetOptions` を使用（Worker関連オプションが必要な場合）

### 新しいプリセット体系

| プリセット | 用途 | バックエンド |
|-----------|------|-------------|
| `stable()` | 最大互換性 | JS |
| `recommended()` | 推奨 (デフォルト) | Worker + WASM |
| `turbo()` | 最高速 | GPU → WASM → JS |

### マイグレーション例

```ts
// Before
engine: EnginePresets.balanced({ workerPool })

// After
engine: EnginePresets.recommended({ workerPool })
```
