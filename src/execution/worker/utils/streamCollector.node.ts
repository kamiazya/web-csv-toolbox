import type {
  ParseBinaryOptions,
  ParseOptions,
} from "../../../common/types.ts";

/**
 * Collect ReadableStream<string> into a single string.
 * Node.js does not support Transferable Streams, so we need to collect the stream first.
 *
 * @internal
 */
export async function collectStringStream(
  stream: ReadableStream<string>,
  signal?: AbortSignal,
): Promise<string> {
  const chunks: string[] = [];
  const reader = stream.getReader();

  // AbortSignal handler for cancelling the stream
  const abortHandler = () => {
    void reader.cancel().catch(() => {
      // Ignore errors during cancellation
    });
  };

  try {
    // Check if already aborted before starting
    if (signal?.aborted) {
      reader.releaseLock();
      throw new DOMException("Aborted", "AbortError");
    }

    // Register abort listener
    if (signal) {
      signal.addEventListener("abort", abortHandler);
    }

    try {
      while (true) {
        // Check abort status before reading
        if (signal?.aborted) {
          throw new DOMException("Aborted", "AbortError");
        }

        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
      }
    } finally {
      // Clean up abort listener
      if (signal) {
        signal.removeEventListener("abort", abortHandler);
      }
    }
  } finally {
    reader.releaseLock();
  }

  return chunks.join("");
}

/**
 * Collect ReadableStream<Uint8Array> into a single Uint8Array.
 * Node.js does not support Transferable Streams, so we need to collect the stream first.
 *
 * @internal
 */
export async function collectUint8ArrayStream(
  stream: ReadableStream<Uint8Array>,
  signal?: AbortSignal,
): Promise<Uint8Array> {
  const chunks: Uint8Array[] = [];
  const reader = stream.getReader();

  // AbortSignal handler for cancelling the stream
  const abortHandler = () => {
    void reader.cancel().catch(() => {
      // Ignore errors during cancellation
    });
  };

  try {
    // Check if already aborted before starting
    if (signal?.aborted) {
      reader.releaseLock();
      throw new DOMException("Aborted", "AbortError");
    }

    // Register abort listener
    if (signal) {
      signal.addEventListener("abort", abortHandler);
    }

    try {
      while (true) {
        // Check abort status before reading
        if (signal?.aborted) {
          throw new DOMException("Aborted", "AbortError");
        }

        const { done, value } = await reader.read();
        if (done) break;
        // Copy the chunk to avoid detached buffer issues
        chunks.push(Uint8Array.from(value));
      }
    } finally {
      // Clean up abort listener
      if (signal) {
        signal.removeEventListener("abort", abortHandler);
      }
    }
  } finally {
    reader.releaseLock();
  }

  // Concatenate all chunks into a single Uint8Array
  const totalLength = chunks.reduce((acc, chunk) => acc + chunk.length, 0);
  const combined = new Uint8Array(totalLength);
  let offset = 0;
  for (const chunk of chunks) {
    combined.set(chunk, offset);
    offset += chunk.length;
  }

  return combined;
}
