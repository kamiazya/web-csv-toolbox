---
"web-csv-toolbox": patch
---

refactor: reorganize WASM module structure with unified API

This change contains internal refactoring to improve code organization and maintainability. **No changes to the public API** - all existing code will continue to work without modification.

⚠️ **Experimental Notice**: WASM automatic initialization (base64-embedded) is experimental and may change in future versions. The current implementation embeds WASM as base64 (~110KB) in the JavaScript bundle for automatic initialization. Future versions may change this loading strategy to optimize bundle size.

## Internal Changes

### 1. WASM Module Organization

The WASM initialization code has been reorganized for better maintainability:

**Before (main branch):**
```
src/wasm/
  ├── loadWASM.ts      # Mixed Node.js/browser implementation
  └── loadWASM.web.ts  # Browser-only implementation
```

**After (this change):**
```
src/wasm/
  ├── loaders/           # Internal implementations (not part of public API)
  │   ├── loadWASM.node.ts   # Node.js-specific loader (refactored from loadWASM.ts)
  │   ├── loadWASM.web.ts    # Browser-specific loader (refactored from loadWASM.web.ts)
  │   ├── loadWASMSync.ts    # New: Synchronous loader
  │   └── wasmState.ts       # New: Shared state management
  └── WasmInstance.ts    # New: Unified public API entry point
```

**Changes:**
- Split Node.js and browser implementations into separate files under `loaders/`
- Added synchronous WASM loader (`loadWASMSync`) for sync parsing APIs
- Extracted shared state management into `wasmState.ts`
- Created `WasmInstance.ts` as the single public API export point

### 2. State Management

Added centralized WASM initialization state tracking:
- New `wasmState.ts` module provides shared state management
- `isInitialized()` and `resetInit()` functions for tracking initialization status
- Shared across async and sync loaders to prevent redundant initialization
- Ensures consistent behavior across different loading strategies

### 3. Documentation Improvements

- Added comprehensive comments explaining the WASM re-export pattern
- Standardized documentation across all loader files
- Clarified why certain architectural decisions were made

## Benefits

- **Better maintainability**: Clear separation between internal loaders and public API
- **Platform-specific optimization**: Separate Node.js and browser implementations
- **Consistent state management**: Centralized tracking prevents redundant initialization
- **Enhanced documentation**: Comprehensive comments explain the architecture
- **No breaking changes**: All existing imports and usage patterns continue to work
