/**
 * WebGPU execution for parseStringStream
 *
 * This module provides GPU-accelerated string stream CSV parsing using WebGPU.
 * It is the core implementation shared by parseStringInGPU.
 */

import type { CSVRecord, ParseOptions } from "@/core/types.ts";

import { parseBinaryStreamInGPU } from "@/parser/execution/gpu/parseBinaryStreamInGPU.ts";

/**
 * Parse CSV string stream using WebGPU
 *
 * @param stream - ReadableStream of CSV strings
 * @param options - Parse options
 * @yields Parsed CSV records
 */
export async function* parseStringStreamInGPU<
  Header extends ReadonlyArray<string>,
  Options extends ParseOptions<Header> = ParseOptions<Header>,
>(
  stream: ReadableStream<string>,
  options?: Options,
): AsyncIterableIterator<CSVRecord<Header>> {
  const encoder = new TextEncoder();

  // Convert string stream to binary stream
  const binaryStream = stream.pipeThrough(
    new TransformStream<string, Uint8Array>({
      transform(chunk, controller) {
        controller.enqueue(encoder.encode(chunk));
      },
    }),
  );

  yield* parseBinaryStreamInGPU(binaryStream, options);
}
