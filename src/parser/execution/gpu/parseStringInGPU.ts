/**
 * WebGPU execution for parseString
 *
 * This module provides GPU-accelerated string CSV parsing using WebGPU.
 */

import type { CSVRecord, ParseOptions } from "@/core/types.ts";

import { parseStringStreamInGPU } from "@/parser/execution/gpu/parseStringStreamInGPU.ts";

/**
 * Parse CSV string using WebGPU
 *
 * @param csv - CSV string to parse
 * @param options - Parse options
 * @yields Parsed CSV records
 */
export async function* parseStringInGPU<
  Header extends ReadonlyArray<string>,
  Options extends ParseOptions<Header> = ParseOptions<Header>,
>(csv: string, options?: Options): AsyncIterableIterator<CSVRecord<Header>> {
  const stream = new ReadableStream<string>({
    start(controller) {
      controller.enqueue(csv);
      controller.close();
    },
  });

  yield* parseStringStreamInGPU(stream, options);
}

/**
 * Check if WebGPU is available in the current environment.
 *
 * @internal
 * @returns True if WebGPU is available, false otherwise
 */
export async function isWebGPUAvailable(): Promise<boolean> {
  try {
    if (typeof navigator === "undefined" || !navigator.gpu) {
      return false;
    }

    const adapter = await navigator.gpu.requestAdapter();
    return adapter !== null;
  } catch {
    return false;
  }
}
