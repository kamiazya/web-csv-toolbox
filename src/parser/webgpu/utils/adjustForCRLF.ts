/**
 * Adjusts field end position to handle CRLF line endings
 */

import { isCR } from "@/parser/webgpu/utils/isCR.ts";

/**
 * Adjusts field end position to handle CRLF line endings
 *
 * If the character before the LF is a CR, moves the end position back by 1
 * to exclude the CR from the field value.
 *
 * @param bytes - Input byte array
 * @param lfOffset - Position of the LF character
 * @returns Adjusted end position for the field
 */
export function adjustForCRLF(bytes: Uint8Array, lfOffset: number): number {
  if (lfOffset > 0 && isCR(bytes[lfOffset - 1]!)) {
    return lfOffset - 1;
  }
  return lfOffset;
}
