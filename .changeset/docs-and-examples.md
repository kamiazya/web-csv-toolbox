---
"web-csv-toolbox": patch
---

docs: comprehensive documentation update and new examples

This release brings significant improvements to the documentation and examples, making it easier to get started and use advanced features.

## New Examples

Added comprehensive example projects for various environments and bundlers:

- **Deno**: `examples/deno-main`, `examples/deno-slim`
- **Node.js**: `examples/node-main`, `examples/node-slim`, `examples/node-worker-main`
- **Vite**: `examples/vite-bundle-main`, `examples/vite-bundle-slim`, `examples/vite-bundle-worker-main`, `examples/vite-bundle-worker-slim`
- **Webpack**: `examples/webpack-bundle-worker-main`, `examples/webpack-bundle-worker-slim`

These examples demonstrate:
- How to use the new `slim` entry point
- Worker integration with different bundlers
- Configuration for Vite and Webpack
- TypeScript setup

## Documentation Improvements

- **Engine Presets**: Detailed guide on choosing the right engine preset for your use case
- **Main vs Slim**: Explanation of the trade-offs between the main (auto-init) and slim (manual-init) entry points
- **WASM Architecture**: Updated architecture documentation reflecting the new module structure
- **Performance Guide**: Improved guide on optimizing performance with WASM and Workers
