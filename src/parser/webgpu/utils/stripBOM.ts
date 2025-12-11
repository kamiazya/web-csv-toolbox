/**
 * Removes BOM from the beginning of a byte array (zero-copy)
 */

import { hasBOM } from "@/parser/webgpu/utils/hasBOM.ts";

/**
 * Removes BOM from the beginning of a byte array (zero-copy)
 *
 * @param bytes - Byte array potentially starting with BOM
 * @returns Subarray without BOM (zero-copy if BOM present, original if not)
 */
export function stripBOM(bytes: Uint8Array): Uint8Array {
  return hasBOM(bytes) ? bytes.subarray(3) : bytes;
}
