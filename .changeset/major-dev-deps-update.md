---
"web-csv-toolbox": patch
---

Update major development dependencies and configurations

- Update Vite from 6.x to 7.1.12
  - Requires Node.js >=20.19.0
  - Updated vite.config.ts for new requirements
- Update Vitest from 3.x to 4.0.3
  - Migrated browser mode configuration to new object format with webdriverio provider
  - Updated test commands in GitHub Actions workflows
  - Added @vitest/browser-webdriverio package
- Update Biome from 1.x to 2.3.0
  - Migrated configuration with `biome migrate --write`
  - Updated organizeImports location in config
  - Fixed biome-ignore comments with proper explanations
- Update TypeScript to 5.9.3
  - Added type assertions for DecompressionStream and TextDecoderStream due to stricter type checking
- Update Rust edition from 2018 to 2021 in web-csv-toolbox-wasm/Cargo.toml
- Update benchmark dependencies
  - @codspeed/tinybench-plugin from 3.1.0 to 5.0.1
  - tinybench from 2.6.0 to 5.1.0
  - Removed explicit warmup() call (now handled automatically)
