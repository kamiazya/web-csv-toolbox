---
"web-csv-toolbox": patch
---

Improve Rust/WASM development environment and add comprehensive tests

## Internal Improvements

- Migrated from Homebrew Rust to rustup for better toolchain management
- Updated Rust dependencies to latest versions (csv 1.4, wasm-bindgen 0.2.105, serde 1.0.228)
- Added 10 comprehensive unit tests for CSV parsing functionality
- Added Criterion-based benchmarks for performance tracking
- Improved error handling in WASM bindings
- Configured rust-analyzer and development tools (rustfmt, clippy)
- Added `pkg/` directory to `.gitignore` (build artifacts should not be tracked)
- Added Rust tests to CI pipeline (GitHub Actions Dynamic Tests workflow)
- Integrated Rust coverage with Codecov (separate from TypeScript with `rust` flag)
- Integrated Rust benchmarks with CodSpeed for performance regression detection

These changes improve code quality and maintainability without affecting the public API or functionality.
