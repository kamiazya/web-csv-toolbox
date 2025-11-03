# TODO: High-level API Queuing Strategy Support

## 問題点

現在、`parse()`, `parseString()`, `parseResponse()`などのhigh-level APIでは、内部で使用される`CSVLexerTransformer`と`CSVRecordAssemblerTransformer`のqueuing strategyをカスタマイズできない。

ユーザーの多くはhigh-level APIを使用するため、パフォーマンスチューニングの方法が不明確になっている。

## 解決策の候補

### Option A: 詳細なストラテジーオプション
```typescript
await parse(csv, {
  lexerWritableStrategy: { highWaterMark: 32 },
  lexerReadableStrategy: { highWaterMark: 64 },
  assemblerWritableStrategy: { highWaterMark: 64 },
  assemblerReadableStrategy: { highWaterMark: 32 },
});
```

**メリット**: 最大限の柔軟性
**デメリット**: APIが複雑になる、初心者には難しい

### Option B: プリセットベース
```typescript
await parse(csv, {
  streamingStrategy: 'high-throughput' | 'balanced' | 'memory-efficient'
});
```

**メリット**: シンプル、初心者フレンドリー
**デメリット**: 柔軟性が限定的、プリセット値の決定が難しい

### Option C: ハイブリッド
```typescript
// プリセット
await parse(csv, { streamingStrategy: 'high-throughput' });

// または詳細設定
await parse(csv, {
  lexerWritableStrategy: { highWaterMark: 32 },
  // ...
});
```

**メリット**: 初心者にも上級者にも対応
**デメリット**: 実装が複雑

## 実装時の考慮事項

1. **既存APIとの互換性**: 既存のオプションとの整合性
2. **型安全性**: TypeScriptでの型推論
3. **ドキュメント**: 使い分けのガイドライン
4. **デフォルト値**: プリセットを追加する場合、適切なデフォルト値の選定
5. **テスト**: 各プリセット・オプションの組み合わせをテスト

## 関連ファイル

- `src/common/types.ts` - ParseOptions型定義
- `src/parse*.ts` - 各種parse関数
- `README.md`, `CLAUDE.md` - ドキュメント
- `benchmark/queuing-strategy.bench.ts` - ベンチマーク

## 参考

- 現在のPR/Issue: (該当する場合記載)
- 関連議論: このTODOファイル作成時の会話ログ
