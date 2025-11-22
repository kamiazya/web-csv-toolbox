/**
 * Shared WASM initialization state.
 *
 * This module provides a single source of truth for WASM initialization state,
 * ensuring that both async (loadWASM) and sync (loadWASMSync) initialization
 * methods coordinate properly.
 *
 * @internal
 */

let initialized = false;

/**
 * Check if WASM has been initialized (via either async or sync method).
 * @returns true if WASM has been initialized
 * @internal
 */
export function isWasmInitialized(): boolean {
  return initialized;
}

/**
 * Mark WASM as initialized.
 * Called by both loadWASM and loadWASMSync after successful initialization.
 * @internal
 */
export function markWasmInitialized(): void {
  initialized = true;
}

/**
 * Reset WASM initialization state.
 * Used for testing and cleanup.
 * @internal
 */
export function resetWasmState(): void {
  initialized = false;
}

/**
 * Public API: Check if WASM has been initialized.
 * @returns true if WASM has been initialized
 * @internal
 */
export function isInitialized(): boolean {
  return initialized;
}

/**
 * Public API: Reset initialization state.
 * @internal
 */
export function resetInit(): void {
  initialized = false;
}
