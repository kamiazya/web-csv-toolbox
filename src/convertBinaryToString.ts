import type { ParseBinaryOptions } from "./common/types.ts";

export function convertBinaryToString<Header extends ReadonlyArray<string>>(
  binary: Uint8Array | ArrayBuffer,
  options?: ParseBinaryOptions<Header>,
): string {
  return new TextDecoder(options?.charset, {
    ignoreBOM: options?.ignoreBOM ?? true,
    fatal: options?.fatal,
  }).decode(binary instanceof ArrayBuffer ? new Uint8Array(binary) : binary);
}
