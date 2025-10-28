import type { ParseBinaryOptions, ParseOptions } from "../../../common/types.ts";
import { addListener, removeListener } from "./workerUtils.ts";

/**
 * Message to send to worker.
 *
 * @internal
 */
export interface WorkerMessage {
  id: number;
  type: string;
  data: any;
  options?: any;
  useWASM?: boolean;
}

/**
 * Stream response from worker.
 * @internal
 */
interface StreamResponse {
  id: number;
  type: "record" | "done" | "error";
  record?: any;
  error?: string;
}

/**
 * Send a message to worker and receive streaming response.
 * Handles abort signals, cleanup, and error handling.
 *
 * @internal
 */
export async function* sendWorkerMessage<T>(
  worker: Worker,
  message: WorkerMessage,
  options?: ParseOptions<any> | ParseBinaryOptions<any>,
  transfer?: Transferable[],
): AsyncIterableIterator<T> {
  let resolveNext: ((value: IteratorResult<T>) => void) | null = null;
  let done = false;
  let error: Error | null = null;

  const handler = (event: MessageEvent) => {
    const data = event.data as StreamResponse;
    if (data.id === message.id) {
      if (data.type === "record" && data.record !== undefined) {
        if (resolveNext) {
          const resolve = resolveNext;
          resolveNext = null;
          resolve({ value: data.record as T, done: false });
        }
      } else if (data.type === "done") {
        done = true;
        if (resolveNext) {
          const resolve = resolveNext;
          resolveNext = null;
          resolve({ value: undefined as any, done: true });
        }
      } else if (data.type === "error") {
        error = new Error(data.error);
        done = true;
        if (resolveNext) {
          const resolve = resolveNext;
          resolveNext = null;
          resolve({ value: undefined as any, done: true });
        }
      }
    }
  };

  let cleanedUp = false;
  const cleanup = () => {
    if (cleanedUp) return;
    cleanedUp = true;
    removeListener(worker, "message", handler);
    removeListener(worker, "error", errorHandler);
    if (options?.signal) {
      options.signal.removeEventListener("abort", abortHandler);
    }
  };

  const errorHandler = (err: ErrorEvent) => {
    error = new Error(err.message);
    done = true;
    if (resolveNext) {
      const resolve = resolveNext;
      resolveNext = null;
      resolve({ value: undefined as any, done: true });
    }
  };

  const abortHandler = () => {
    try {
      worker.postMessage({ id: message.id, type: "abort" });
    } catch {
      // Ignore errors if worker is already terminated
    }
    error = new DOMException("Aborted", "AbortError");
    done = true;
    if (resolveNext) {
      const resolve = resolveNext;
      resolveNext = null;
      resolve({ value: undefined as any, done: true });
    }
  };

  addListener(worker, "message", handler);
  addListener(worker, "error", errorHandler);

  // Wire abort signal if present
  if (options?.signal) {
    if (options.signal.aborted) {
      cleanup();
      throw new DOMException("Aborted", "AbortError");
    }
    options.signal.addEventListener("abort", abortHandler);
  }

  // Send message
  try {
    if (transfer) {
      worker.postMessage(message, transfer);
    } else {
      worker.postMessage(message);
    }
  } catch (err) {
    cleanup();
    throw err;
  }

  // Yield records as they arrive
  try {
    while (!done) {
      if (error) {
        throw error;
      }
      // Wait for next record
      const result = await new Promise<IteratorResult<T>>((resolve) => {
        resolveNext = resolve;
      });
      if (error) {
        throw error;
      }
      // If we got a record, yield it
      if (!result.done && result.value !== undefined) {
        yield result.value;
      }
      // If done, exit
      if (result.done) {
        break;
      }
    }
  } finally {
    cleanup();
  }
}
