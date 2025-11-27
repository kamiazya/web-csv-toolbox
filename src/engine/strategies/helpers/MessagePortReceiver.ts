/**
 * Receives parsed records from a worker via MessagePort.
 *
 * This helper encapsulates the queue-based async iteration pattern
 * for receiving streaming results from a worker.
 *
 * @param port - MessagePort to receive results from
 * @param signal - Optional AbortSignal for cancellation
 * @internal
 */
export async function* receiveResults<T>(
  port: MessagePort,
  signal?: AbortSignal,
): AsyncIterableIterator<T> {
  const queue: T[] = [];
  let done = false;
  let error: Error | null = null;
  let resolveNext: (() => void) | null = null;

  // Set up abort handling
  const abortHandler = () => {
    error = new DOMException("Aborted", "AbortError");
    if (resolveNext) resolveNext();
    port.close();
  };

  if (signal) {
    if (signal.aborted) {
      port.close();
      throw new DOMException("Aborted", "AbortError");
    }
    signal.addEventListener("abort", abortHandler);
  }

  // Set up message handler
  port.onmessage = (event: MessageEvent) => {
    const message = event.data;

    if (message.type === "record") {
      queue.push(message.record);
      if (resolveNext) {
        resolveNext();
        resolveNext = null;
      }
    } else if (message.type === "done") {
      done = true;
      if (resolveNext) {
        resolveNext();
        resolveNext = null;
      }
      port.close();
    } else if (message.type === "error") {
      error = new Error(message.error);
      if (resolveNext) {
        resolveNext();
        resolveNext = null;
      }
      port.close();
    }
  };

  port.onmessageerror = (event: MessageEvent) => {
    error = new Error(`Message deserialization error: ${event.data}`);
    if (resolveNext) {
      resolveNext();
      resolveNext = null;
    }
    port.close();
  };

  // Start the port
  port.start();

  try {
    // Yield records as they arrive
    while (!done && !error) {
      if (queue.length > 0) {
        yield queue.shift()!;
      } else {
        // Wait for next message
        await new Promise<void>((resolve) => {
          resolveNext = resolve;
        });
      }
    }

    // Yield any remaining records
    while (queue.length > 0) {
      yield queue.shift()!;
    }

    // Throw error if one occurred
    if (error) {
      throw error;
    }
  } finally {
    if (signal) {
      signal.removeEventListener("abort", abortHandler);
    }
    port.close();
  }
}
