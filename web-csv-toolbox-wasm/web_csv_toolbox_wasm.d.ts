/* tslint:disable */
/* eslint-disable */
/**
 * Parse CSV string to array synchronously (WASM binding)
 *
 * # Arguments
 *
 * * `input` - CSV string to parse
 * * `delimiter` - Delimiter character (e.g., b',' for comma)
 * * `max_buffer_size` - Maximum allowed input size in bytes
 * * `source` - Optional source identifier for error reporting (e.g., filename). Pass empty string for None.
 *
 * # Returns
 *
 * Result containing JsValue with the JSON string representation of parsed CSV data.
 *
 * # Errors
 *
 * Returns a JsError if parsing fails or input size exceeds limit, which will be thrown as a JavaScript error.
 */
export function parseStringToArraySync(input: string, delimiter: number, max_buffer_size: number, source: string): any;

export type InitInput = RequestInfo | URL | Response | BufferSource | WebAssembly.Module;

export interface InitOutput {
  readonly memory: WebAssembly.Memory;
  readonly parseStringToArraySync: (a: number, b: number, c: number, d: number, e: number, f: number) => [number, number, number];
  readonly __wbindgen_externrefs: WebAssembly.Table;
  readonly __wbindgen_malloc: (a: number, b: number) => number;
  readonly __wbindgen_realloc: (a: number, b: number, c: number, d: number) => number;
  readonly __externref_table_dealloc: (a: number) => void;
  readonly __wbindgen_start: () => void;
}

export type SyncInitInput = BufferSource | WebAssembly.Module;
/**
* Instantiates the given `module`, which can either be bytes or
* a precompiled `WebAssembly.Module`.
*
* @param {{ module: SyncInitInput }} module - Passing `SyncInitInput` directly is deprecated.
*
* @returns {InitOutput}
*/
export function initSync(module: { module: SyncInitInput } | SyncInitInput): InitOutput;

/**
* If `module_or_path` is {RequestInfo} or {URL}, makes a request and
* for everything else, calls `WebAssembly.instantiate` directly.
*
* @param {{ module_or_path: InitInput | Promise<InitInput> }} module_or_path - Passing `InitInput` directly is deprecated.
*
* @returns {Promise<InitOutput>}
*/
export default function __wbg_init (module_or_path?: { module_or_path: InitInput | Promise<InitInput> } | InitInput | Promise<InitInput>): Promise<InitOutput>;
