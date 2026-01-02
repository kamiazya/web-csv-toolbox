import type { InitInput, SyncInitInput } from "web-csv-toolbox-wasm";
import {
  loadWasm as internalLoadWasm,
  isInitialized,
  resetInit,
} from "#/wasm/loaders/loadWasm.js";
import {
  getWasmModule,
  loadWasmSync as internalLoadWasmSync,
  isSyncInitialized,
  resetSyncInit,
} from "#/wasm/loaders/loadWasmSync.js";

/**
 * Re-export all Wasm functions from this module to ensure they share the same Wasm instance.
 *
 * Why this is necessary:
 * 1. The loaders call init() which initializes the Wasm module's internal global state
 * 2. If Wasm functions are imported directly from "web-csv-toolbox-wasm" elsewhere,
 *    they may reference a different module context in some environments (e.g., test runners)
 * 3. This can lead to errors like "Cannot read properties of undefined (reading '__wbindgen_malloc')"
 *    because the Wasm instance accessed by those functions hasn't been initialized
 * 4. By re-exporting all functions from the same module that handles initialization,
 *    we ensure they always reference the same initialized Wasm instance
 *
 * Using `export *` instead of individual named exports:
 * - Automatically includes all current and future Wasm functions
 * - No maintenance needed when new functions are added to web-csv-toolbox-wasm
 * - Maintains type safety through TypeScript's type inference
 */
export * from "web-csv-toolbox-wasm";

/**
 * Re-export state management functions.
 * This provides a unified API for all Wasm-related functionality.
 */
export {
  isInitialized,
  resetInit,
  isSyncInitialized,
  resetSyncInit,
  getWasmModule,
};

/**
 * Load and initialize the WebAssembly module (async).
 *
 * Wasm will auto-initialize on first use if not preloaded.
 * This function is useful for:
 * - Warming up the Wasm module before first use
 * - Custom initialization input (advanced use case)
 *
 * **Backward compatible:** This function works the same as the previous `loadWasm()`.
 *
 * @param input - Optional custom initialization input
 *
 * @example
 * ```ts
 * import { loadWasm } from 'web-csv-toolbox';
 *
 * // Optional preload
 * await loadWasm();
 *
 * // Now Wasm functions are ready (but they auto-initialize anyway)
 * ```
 *
 * @example
 * No preload needed - auto-initialization
 * ```ts
 * import { parseString } from 'web-csv-toolbox';
 *
 * // Wasm auto-initializes on first use
 * const result = parseString.toArraySync(csv, { engine: { wasm: true } });
 * ```
 */
export async function loadWasm(input?: InitInput): Promise<void> {
  if (isInitialized()) {
    return;
  }

  // Use async initialization for better bundle size
  // Browser: fetches Wasm from network
  // Node.js: reads Wasm from file system
  await internalLoadWasm(input);
}

/**
 * Load and initialize the WebAssembly module synchronously.
 *
 * This function uses the inlined Wasm module (base64-encoded at build time)
 * to enable synchronous initialization. This is useful for:
 * - Synchronous APIs with `{ engine: { wasm: true } }` option
 * - Contexts where async initialization is not possible
 *
 * **Trade-offs:**
 * - ✅ Synchronous initialization - no await needed
 * - ✅ Works in synchronous contexts
 * - ❌ Larger bundle size (Wasm inlined as base64)
 * - ❌ Slower initial load time
 *
 * **Backward compatible:** This function works the same as the previous `loadWasmSync()`.
 *
 * @param input - Optional custom initialization input. If not provided, uses inlined Wasm.
 *
 * @example
 * ```ts
 * import { loadWasmSync, parseString } from 'web-csv-toolbox';
 *
 * // Synchronous initialization
 * loadWasmSync();
 *
 * // Now you can use sync APIs with Wasm without await
 * const result = parseString.toArraySync(csv, { engine: { wasm: true } });
 * ```
 */
export function loadWasmSync(input?: SyncInitInput): void {
  if (isSyncInitialized()) {
    return;
  }

  internalLoadWasmSync(input);
}

/**
 * Check if Wasm module is ready.
 *
 * @returns True if Wasm is initialized
 *
 * @example
 * ```ts
 * import { isWasmReady } from 'web-csv-toolbox';
 *
 * if (isWasmReady()) {
 *   console.log('Wasm is ready');
 * }
 * ```
 */
export function isWasmReady(): boolean {
  return isInitialized();
}

/**
 * Ensure Wasm module is initialized.
 * Auto-initializes if not already initialized.
 *
 * @internal
 */
export async function ensureWasmInitialized(): Promise<void> {
  if (!isInitialized()) {
    await loadWasm();
  }
}
