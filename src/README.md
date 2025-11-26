# Source Code Architecture

This document describes the file naming conventions and architectural patterns used in the `web-csv-toolbox` source code.

## File Naming Conventions

The project uses a systematic naming convention to organize code across different environments (Node.js vs Web) and variants (main vs slim).

### Pattern Overview

```
src/
├── common.ts              # Core APIs shared across ALL variants and environments
├── *.shared.ts           # Shared code within a specific variant (Node.js + Web)
│   ├── main.shared.ts    # Shared between main.node.ts and main.web.ts
│   ├── slim.shared.ts    # Shared between slim.node.ts and slim.web.ts
│   └── *.shared.ts       # Other shared implementations
├── *.node.ts             # Node.js-specific implementation
├── *.web.ts              # Web/Browser-specific implementation
└── *.ts                  # Generic/shared implementation (no environment suffix)
```

### Naming Patterns Explained

#### 1. `common.ts`
**Purpose:** Contains exports that are available in **all** entry points and **all** environments.

**Contains:**
- Core types, constants, and errors
- Parser APIs (all async APIs)
- Parser models and transformers
- Utility functions

**Example:**
```typescript
// src/common.ts
export * from "./core/types.ts";
export * from "./parser/api/parse.ts";
export * from "./utils/file/getOptionsFromFile.ts";
```

**Used by:** `main.shared.ts`, `slim.shared.ts`

---

#### 2. `*.shared.ts`
**Purpose:** Contains exports shared within a **specific variant** across **both** Node.js and Web environments.

**Pattern:** `<variant>.shared.ts`

**Examples:**
- `main.shared.ts` - Shared exports for the main variant
- `slim.shared.ts` - Shared exports for the slim variant
- `ReusableWorkerPool.shared.ts` - Shared worker pool implementation
- `worker.shared.ts` - Shared worker message handling

**Structure:**
```typescript
// src/main.shared.ts
export * from "./common.ts";                    // Re-export all common APIs
export * from "./worker/helpers/WorkerSession.ts";  // Variant-specific shared code
// Note: WasmInstance.main is exported from environment-specific files (main.node.ts/main.web.ts)
```

**Used by:** `*.node.ts`, `*.web.ts` of the same variant

---

#### 3. `*.node.ts`
**Purpose:** Contains **Node.js-specific** implementations.

**Pattern:** `<name>.node.ts`

**Key characteristics:**
- Uses Node.js APIs (`node:worker_threads`, `node:fs`, `node:path`, etc.)
- May have different function signatures from `.web.ts` counterpart
- Resolved at build-time by Vite plugin based on file name

**Examples:**
```typescript
// src/main.node.ts - Node.js entry point
export * from "./main.shared.ts";                    // Re-export shared
export * from "./worker/helpers/ReusableWorkerPool.node.ts";  // Node-specific

// src/wasm/loaders/loadWASM.node.ts - Node.js WASM loader
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
```

---

#### 4. `*.web.ts`
**Purpose:** Contains **Web/Browser-specific** implementations.

**Pattern:** `<name>.web.ts`

**Key characteristics:**
- Uses Web APIs (`Worker`, `fetch`, `DecompressionStream`, etc.)
- May have different function signatures from `.node.ts` counterpart
- Resolved at build-time by Vite plugin based on file name

**Examples:**
```typescript
// src/main.web.ts - Web entry point
export * from "./main.shared.ts";                    // Re-export shared
export * from "./worker/helpers/ReusableWorkerPool.web.ts";  // Web-specific

// src/wasm/loaders/loadWASM.web.ts - Web WASM loader
const response = await fetch(wasmUrl);
const wasmModule = await WebAssembly.compileStreaming(response);
```

---

#### 5. Generic `.ts` files
**Purpose:** Environment-agnostic implementations that work in both Node.js and Web.

**Pattern:** `<name>.ts` (no suffix)

**Examples:**
- `src/parser/models/FlexibleCSVRecordAssembler.ts`
- `src/core/types.ts`
- `src/utils/validation/assertCommonOptions.ts`

---

## Build-Time Resolution

The project uses a custom Vite plugin (`vite-plugin-resolve-imports.ts`) to resolve environment-specific imports at build time.

### How it works

1. **During development** (`vite serve`):
   ```typescript
   // vite.config.ts - Development aliases
   "#/wasm/loaders/loadWASM.js": "/src/wasm/loaders/loadWASM.web.ts"
   ```

2. **During build** (`vite build`):
   ```typescript
   // Plugin detects entry file name and resolves imports accordingly
   // Entry: main.node.ts → #/wasm/loaders/loadWASM.js → loadWASM.node.ts
   // Entry: main.web.ts  → #/wasm/loaders/loadWASM.js → loadWASM.web.ts
   ```

3. **At runtime** (published package):
   ```json
   // package.json - Runtime resolution
   "imports": {
     "#/wasm/loaders/loadWASM.js": {
       "node": "./dist/wasm/loaders/loadWASM.node.js",
       "browser": "./dist/wasm/loaders/loadWASM.web.js",
       "default": "./dist/wasm/loaders/loadWASM.web.js"
     }
   }
   ```

---

## Entry Points Architecture

### Entry Point Location Policy

**All package entry points MUST be located directly under `src/`.**

This is a fundamental architectural principle for this project:

- ✅ **DO:** Place entry points at `src/main.{node,web}.ts`, `src/slim.{node,web}.ts`, etc.
- ❌ **DON'T:** Place entry points in subdirectories like `src/entries/main.ts`

**Rationale:**
1. **Discoverability:** Entry points are immediately visible in the root directory
2. **Simplicity:** Build configuration is simpler with flat entry point structure
3. **Convention:** Follows common TypeScript library patterns (e.g., `src/index.ts`)
4. **Package.json alignment:** Entry points in `src/` map directly to `dist/` outputs

**Current entry points:**
```
src/
├── main.node.ts          # Main variant - Node.js
├── main.web.ts           # Main variant - Web/Browser
├── main.shared.ts        # Main variant - Shared code
├── slim.node.ts          # Slim variant - Node.js
├── slim.web.ts           # Slim variant - Web/Browser
├── slim.shared.ts        # Slim variant - Shared code
├── worker.node.ts        # Worker entry - Node.js
├── worker.web.ts         # Worker entry - Web/Browser
└── common.ts             # Common code across all variants
```

**Build output mapping:**
```
src/main.node.ts   →  dist/main.node.js
src/main.web.ts    →  dist/main.web.js
src/slim.node.ts   →  dist/slim.node.js
src/slim.web.ts    →  dist/slim.web.js
src/worker.node.ts →  dist/worker.node.js
src/worker.web.ts  →  dist/worker.web.js
```

---

### Main Entry (`main.{node,web}.ts`)

**Features:**
- Auto-initialization with base64-inlined WASM
- All WASM functions available without manual initialization
- Larger bundle size

**Structure:**
```
main.node.ts / main.web.ts
  ├── main.shared.ts
  │   ├── common.ts (all core APIs)
  │   ├── WorkerSession
  │   └── WasmInstance.main
  └── ReusableWorkerPool.{node,web}.ts (environment-specific)
```

### Slim Entry (`slim.{node,web}.ts`)

**Features:**
- Manual WASM initialization required
- Smaller bundle size
- WASM loaded at runtime

**Structure:**
```
slim.node.ts / slim.web.ts
  ├── slim.shared.ts
  │   ├── common.ts (all core APIs)
  │   └── WorkerSession
  ├── WasmInstance.slim.{node,ts} (environment-specific)
  └── ReusableWorkerPool.{node,web}.ts (environment-specific)
```

---

## When to Use Each Pattern

### Use `common.ts`
- ✅ Code used by **all** entry points (main, slim, worker)
- ✅ Code that works in **all** environments (Node.js, Web, Deno)
- ✅ Core types, constants, shared utilities

### Use `*.shared.ts`
- ✅ Code shared within a **specific variant** (main or slim)
- ✅ Code that works in **both** Node.js and Web
- ✅ Reduces duplication between `.node.ts` and `.web.ts`

### Use `.node.ts` / `.web.ts`
- ✅ Environment-specific APIs required (Node.js vs Web)
- ✅ Different implementations for the same functionality
- ✅ Build-time conditional imports via `#/` paths

### Use generic `.ts`
- ✅ Environment-agnostic utilities
- ✅ Pure TypeScript logic with no environment-specific APIs
- ✅ Shared models, types, transformers

---

## Examples

### Example 1: Worker Pool Implementation

```
worker/helpers/
├── ReusableWorkerPool.shared.ts   # Core pool logic (both environments)
├── ReusableWorkerPool.node.ts     # Node.js-specific (extends shared)
├── ReusableWorkerPool.web.ts      # Web-specific (extends shared)
├── createWorker.node.ts            # Node.js Worker creation
└── createWorker.web.ts             # Web Worker creation
```

### Example 2: WASM Loading

```
wasm/loaders/
├── loadWASM.node.ts        # Node.js: fs.readFile + Buffer
├── loadWASM.web.ts         # Web: fetch + Uint8Array.fromBase64
├── loadWASMSync.node.ts    # Node.js: synchronous Buffer loading
└── loadWASMSync.web.ts     # Web: synchronous base64 decoding
```

### Example 3: Entry Points

```
src/
├── common.ts               # Shared across all variants
├── main.shared.ts         # Main variant shared code
├── main.node.ts           # Main + Node.js
├── main.web.ts            # Main + Web
├── slim.shared.ts         # Slim variant shared code
├── slim.node.ts           # Slim + Node.js
└── slim.web.ts            # Slim + Web
```

---

## Guidelines for Contributors

### Adding New Features

1. **Is it environment-agnostic?**
   - Yes → Use generic `.ts` file
   - No → Go to step 2

2. **Is it used by all variants?**
   - Yes → Add to `common.ts`
   - No → Go to step 3

3. **Is it specific to one variant but works in both environments?**
   - Yes → Add to `<variant>.shared.ts` (e.g., `main.shared.ts`)
   - No → Go to step 4

4. **Is it environment-specific?**
   - Yes → Create both `.node.ts` and `.web.ts` versions

### Refactoring Duplicated Code

If you find duplicated code in `.node.ts` and `.web.ts`:

1. Extract common logic to a `.shared.ts` file
2. Keep only environment-specific parts in `.node.ts` / `.web.ts`
3. Both files should import and re-export from `.shared.ts`

**Example:**
```typescript
// Before
// foo.node.ts - 100 lines (80 common + 20 Node-specific)
// foo.web.ts  - 100 lines (80 common + 20 Web-specific)

// After
// foo.shared.ts - 80 lines (common logic)
// foo.node.ts   - 20 lines (Node-specific + re-export shared)
// foo.web.ts    - 20 lines (Web-specific + re-export shared)
```

---

## Key Principles

1. **DRY (Don't Repeat Yourself):** Use `.shared.ts` to eliminate duplication
2. **Explicit over Implicit:** File naming should clearly indicate purpose
3. **Build-time Resolution:** Leverage Vite plugin for conditional imports
4. **Runtime Flexibility:** Use package.json exports for runtime resolution
5. **Type Safety:** Maintain full TypeScript type checking across all variants

---

## Related Documentation

- [Vite Plugin: Resolve Imports](../config/vite-plugin-resolve-imports.ts)
- [Package Exports](../package.json) - Runtime resolution configuration
- [Build Configuration](../vite.config.ts)
