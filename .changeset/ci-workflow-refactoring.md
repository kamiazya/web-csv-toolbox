---
"web-csv-toolbox": patch
---

Refactor CI workflows to separate TypeScript and Rust environments

This change improves CI efficiency by:
- Splitting setup actions into setup-typescript, setup-rust, and setup-full
- Separating WASM build and TypeScript build jobs with clear dependencies
- Removing unnecessary tool installations from jobs that don't need them
- Clarifying dependencies between TypeScript tests and WASM artifacts
