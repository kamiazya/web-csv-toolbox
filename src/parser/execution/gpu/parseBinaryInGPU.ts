/**
 * WebGPU execution for parseBinary
 *
 * This module provides GPU-accelerated binary CSV parsing using WebGPU.
 */

import type { CSVRecord, ParseOptions } from "@/core/types.ts";

import { parseBinaryStreamInGPU } from "@/parser/execution/gpu/parseBinaryStreamInGPU.ts";

/**
 * Parse binary data using WebGPU
 *
 * @param bytes - Binary CSV data
 * @param options - Parse options
 * @yields Parsed CSV records
 */
export async function* parseBinaryInGPU<
  Header extends ReadonlyArray<string>,
  Options extends ParseOptions<Header> = ParseOptions<Header>,
>(
  bytes: Uint8Array,
  options?: Options,
): AsyncIterableIterator<CSVRecord<Header>> {
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(bytes);
      controller.close();
    },
  });

  yield* parseBinaryStreamInGPU(stream, options);
}
