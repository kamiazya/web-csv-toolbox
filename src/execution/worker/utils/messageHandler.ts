import type { CSVRecord, ParseBinaryOptions, ParseOptions } from "../../../common/types.ts";
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
 * Send a message to worker and wait for response.
 * Handles abort signals, cleanup, and error handling.
 *
 * @internal
 */
export async function sendWorkerMessage<T>(
  worker: Worker,
  message: WorkerMessage,
  options?: ParseOptions<any> | ParseBinaryOptions<any>,
  transfer?: Transferable[],
): Promise<T> {
  return new Promise((resolve, reject) => {
    const handler = (event: MessageEvent) => {
      if (event.data.id === message.id) {
        cleanup();
        if (event.data.error) {
          reject(new Error(event.data.error));
        } else {
          resolve(event.data.result);
        }
      }
    };

    const errorHandler = (error: ErrorEvent) => {
      cleanup();
      reject(error);
    };

    const abortHandler = () => {
      cleanup();
      try {
        worker.postMessage({ id: message.id, type: "abort" });
      } catch {
        // Ignore errors if worker is already terminated
      }
      reject(new DOMException("Aborted", "AbortError"));
    };

    const cleanup = () => {
      removeListener(worker, "message", handler);
      removeListener(worker, "error", errorHandler);
      if (options?.signal) {
        options.signal.removeEventListener("abort", abortHandler);
      }
    };

    addListener(worker, "message", handler);
    addListener(worker, "error", errorHandler);

    // Wire abort signal if present
    if (options?.signal) {
      if (options.signal.aborted) {
        cleanup();
        reject(new DOMException("Aborted", "AbortError"));
        return;
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
    } catch (error) {
      cleanup();
      reject(error);
    }
  });
}
