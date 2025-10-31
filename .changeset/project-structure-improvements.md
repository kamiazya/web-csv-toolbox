---
"web-csv-toolbox": patch
---

Improve project structure and organization

- Move WASM build artifact ignore rules to web-csv-toolbox-wasm/.gitignore
- Remove build-dependencies from web-csv-toolbox-wasm/Cargo.toml (compiler_builtins, cxx-build, wasm-opt, wasm-pack)
- Clean up unintentionally tracked web-csv-toolbox-wasm/pkg files
