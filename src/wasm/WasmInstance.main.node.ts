import type { InitInput, SyncInitInput } from "web-csv-toolbox-wasm";
import {
  loadWASM as internalLoadWASM,
  isInitialized,
  resetInit,
} from "#/wasm/loaders/loadWASM.js";
import {
  getWasmModule,
  loadWASMSync as internalLoadWASMSync,
  isSyncInitialized,
  resetSyncInit,
} from "#/wasm/loaders/loadWASMSync.js";

/**
 * Re-export all WASM functions from this module to ensure they share the same WASM instance.
 *
 * Why this is necessary:
 * 1. The loaders call init() which initializes the WASM module's internal global state
 * 2. If WASM functions are imported directly from "web-csv-toolbox-wasm" elsewhere,
 *    they may reference a different module context in some environments (e.g., test runners)
 * 3. This can lead to errors like "Cannot read properties of undefined (reading '__wbindgen_malloc')"
 *    because the WASM instance accessed by those functions hasn't been initialized
 * 4. By re-exporting all functions from the same module that handles initialization,
 *    we ensure they always reference the same initialized WASM instance
 *
 * Using `export *` instead of individual named exports:
 * - Automatically includes all current and future WASM functions
 * - No maintenance needed when new functions are added to web-csv-toolbox-wasm
 * - Maintains type safety through TypeScript's type inference
 */
export * from "web-csv-toolbox-wasm";

/**
 * Re-export state management functions.
 * This provides a unified API for all WASM-related functionality.
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
 * WASM will auto-initialize on first use if not preloaded.
 * This function is useful for:
 * - Warming up the WASM module before first use
 * - Custom initialization input (advanced use case)
 *
 * **Backward compatible:** This function works the same as the previous `loadWASM()`.
 *
 * @param input - Optional custom initialization input
 *
 * @example
 * ```ts
 * import { loadWASM } from 'web-csv-toolbox';
 *
 * // Optional preload
 * await loadWASM();
 *
 * // Now WASM functions are ready (but they auto-initialize anyway)
 * ```
 *
 * @example
 * No preload needed - auto-initialization
 * ```ts
 * import { parseString } from 'web-csv-toolbox';
 *
 * // WASM auto-initializes on first use
 * const result = parseString.toArraySync(csv, { engine: { wasm: true } });
 * ```
 */
export async function loadWASM(input?: InitInput): Promise<void> {
  if (isInitialized()) {
    return;
  }

  // Use async initialization for better bundle size
  // Browser: fetches WASM from network
  // Node.js: reads WASM from file system
  await internalLoadWASM(input);
}

/**
 * Load and initialize the WebAssembly module synchronously.
 *
 * This function uses the inlined WASM module (base64-encoded at build time)
 * to enable synchronous initialization. This is useful for:
 * - Synchronous APIs with `{ engine: { wasm: true } }` option
 * - Contexts where async initialization is not possible
 *
 * **Trade-offs:**
 * - ✅ Synchronous initialization - no await needed
 * - ✅ Works in synchronous contexts
 * - ❌ Larger bundle size (WASM inlined as base64)
 * - ❌ Slower initial load time
 *
 * **Backward compatible:** This function works the same as the previous `loadWASMSync()`.
 *
 * @param input - Optional custom initialization input. If not provided, uses inlined WASM.
 *
 * @example
 * ```ts
 * import { loadWASMSync, parseString } from 'web-csv-toolbox';
 *
 * // Synchronous initialization
 * loadWASMSync();
 *
 * // Now you can use sync APIs with WASM without await
 * const result = parseString.toArraySync(csv, { engine: { wasm: true } });
 * ```
 */
export function loadWASMSync(input?: SyncInitInput): void {
  if (isSyncInitialized()) {
    return;
  }

  internalLoadWASMSync(input);
}

/**
 * Check if WASM module is ready.
 *
 * @returns True if WASM is initialized
 *
 * @example
 * ```ts
 * import { isWASMReady } from 'web-csv-toolbox';
 *
 * if (isWASMReady()) {
 *   console.log('WASM is ready');
 * }
 * ```
 */
export function isWASMReady(): boolean {
  return isInitialized();
}

/**
 * Ensure WASM module is initialized.
 * Auto-initializes if not already initialized.
 *
 * @internal
 */
export async function ensureWASMInitialized(): Promise<void> {
  if (!isInitialized()) {
    await loadWASM();
  }
}
