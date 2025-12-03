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
let simdSupported: boolean | null = null;

/**
 * WASM SIMD detection bytecode.
 * This is a minimal valid WASM module that uses SIMD128 instructions.
 * Format: (module (func (v128.const i32x4 0 0 0 0) drop))
 */
const SIMD_TEST_BYTES = new Uint8Array([
  0x00,
  0x61,
  0x73,
  0x6d, // magic number (\0asm)
  0x01,
  0x00,
  0x00,
  0x00, // version 1
  0x01,
  0x05,
  0x01,
  0x60, // type section: 1 function type, params: () -> ()
  0x00,
  0x00,
  0x03,
  0x02, // function section: 1 function
  0x01,
  0x00,
  0x0a,
  0x12, // code section
  0x01,
  0x10,
  0x00, // 1 function body, 16 bytes, 0 locals
  0xfd,
  0x0c, // v128.const
  0x00,
  0x00,
  0x00,
  0x00, // i32x4 lane 0
  0x00,
  0x00,
  0x00,
  0x00, // i32x4 lane 1
  0x00,
  0x00,
  0x00,
  0x00, // i32x4 lane 2
  0x00,
  0x00,
  0x00,
  0x00, // i32x4 lane 3
  0x1a, // drop
  0x0b, // end
]);

/**
 * Detect if the runtime supports WebAssembly SIMD128.
 * Result is cached after first call.
 *
 * @returns true if WASM SIMD128 is supported
 * @internal
 */
export function hasWasmSimd(): boolean {
  if (simdSupported !== null) {
    return simdSupported;
  }

  try {
    // Check if WebAssembly.validate exists and can validate SIMD bytecode
    simdSupported =
      typeof WebAssembly !== "undefined" &&
      typeof WebAssembly.validate === "function" &&
      WebAssembly.validate(SIMD_TEST_BYTES);
  } catch {
    simdSupported = false;
  }

  return simdSupported;
}

/**
 * Determine if WASM engine should be used based on SIMD support.
 *
 * Strategy:
 * - SIMD supported (95%+ browsers): Use WASM for optimal performance
 * - SIMD not supported: Fall back to JavaScript engine
 *
 * @returns true if WASM should be used
 * @internal
 */
export function shouldUseWasmEngine(): boolean {
  return hasWasmSimd();
}

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
  simdSupported = null;
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
