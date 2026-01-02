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

declare module "#/wasm/loaders/loadWasm.js" {
  export type { InitInput, InitOutput } from "web-csv-toolbox-wasm";
  export function loadWasm(input?: InitInput): Promise<void>;
  export function isInitialized(): boolean;
  export function resetInit(): void;
  export * from "web-csv-toolbox-wasm";
}

declare module "#/wasm/loaders/loadWasmSync.js" {
  export type { SyncInitInput, InitOutput } from "web-csv-toolbox-wasm";
  export function loadWasmSync(input?: SyncInitInput): void;
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

declare module "#/parser/api/string/parseStringToArraySyncWasm.main.js" {
  import type {
    DEFAULT_DELIMITER,
    DEFAULT_QUOTATION,
  } from "@/core/constants.ts";
  import type {
    CommonOptions,
    CSVRecord,
    PickCSVHeader,
  } from "@/core/types.ts";

  export function parseStringToArraySyncWasm<
    const CSVSource extends string,
    const Delimiter extends string = DEFAULT_DELIMITER,
    const Quotation extends string = DEFAULT_QUOTATION,
    const Header extends ReadonlyArray<string> = PickCSVHeader<
      CSVSource,
      Delimiter,
      Quotation
    >,
  >(
    csv: CSVSource,
    options: CommonOptions<Delimiter, Quotation>,
  ): CSVRecord<Header>[];

  export function parseStringToArraySyncWasm<
    const CSVSource extends string,
    const Delimiter extends string = DEFAULT_DELIMITER,
    const Quotation extends string = DEFAULT_QUOTATION,
    const Header extends ReadonlyArray<string> = PickCSVHeader<CSVSource>,
  >(
    csv: CSVSource,
    options?: CommonOptions<Delimiter, Quotation>,
  ): CSVRecord<Header>[];

  export function parseStringToArraySyncWasm<
    const Header extends ReadonlyArray<string>,
    const Delimiter extends string = DEFAULT_DELIMITER,
    const Quotation extends string = DEFAULT_QUOTATION,
  >(
    csv: string,
    options?: CommonOptions<Delimiter, Quotation>,
  ): CSVRecord<Header>[];
}
