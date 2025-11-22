/**
 * Type definitions for internal module imports using package.json "imports" field.
 *
 * These modules are resolved to environment-specific implementations
 * (node vs browser) based on the build context.
 */

declare module "#/csv.wasm" {
  /**
   * WASM buffer (ArrayBuffer) for the web-csv-toolbox WASM module.
   *
   * - In Node.js: Decoded from base64 using Buffer.from()
   * - In browsers: Decoded from base64 using Uint8Array.fromBase64()
   */
  const wasmBuffer: ArrayBuffer;
  export default wasmBuffer;
}

declare module "#/wasm/loaders/loadWASM.js" {
  export type { InitInput, InitOutput } from "web-csv-toolbox-wasm";
  export function loadWASM(input?: InitInput): Promise<void>;
  export function isInitialized(): boolean;
  export function resetInit(): void;
  export * from "web-csv-toolbox-wasm";
}

declare module "#/wasm/loaders/loadWASMSync.js" {
  export type { SyncInitInput, InitOutput } from "web-csv-toolbox-wasm";
  export function loadWASMSync(input?: SyncInitInput): void;
  export function isSyncInitialized(): boolean;
  export function getWasmModule(): InitOutput | undefined;
  export function resetSyncInit(): void;
  export * from "web-csv-toolbox-wasm";
}

declare module "#/worker/helpers/createWorker.js" {
  export function createWorker(workerURL?: string | URL): Promise<Worker>;
}

declare module "#/utils/response/getOptionsFromResponse.constants.js" {
  export const SUPPORTED_COMPRESSIONS: ReadonlySet<string>;
}

declare module "#/utils/charset/getCharsetValidation.constants.js" {
  export const SUPPORTED_CHARSETS: ReadonlySet<string>;
}
