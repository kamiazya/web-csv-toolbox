/**
 * Cross-platform event listener utilities for Web Workers and Node.js Worker Threads.
 * @internal
 */

type EventHandler = (event: any) => void;

// Store mapping of original handlers to normalized handlers for Node.js
const handlerMap = new WeakMap<object, Map<EventHandler, EventHandler>>();

/**
 * Add event listener to worker (compatible with both Web Workers and Node.js Worker Threads)
 */
export function addListener(
  worker: Worker,
  event: "message" | "error",
  handler: EventHandler,
): void {
  if ("addEventListener" in worker) {
    // Web Workers API (browser, Deno)
    worker.addEventListener(event, handler);
  } else {
    // Node.js Worker Threads API
    // In Node.js, message data is passed directly, not wrapped in event.data
    // We need to normalize it to match the Web Workers API
    const normalizedHandler =
      event === "message" ? (data: any) => handler({ data }) : handler;

    // Store the mapping so we can remove it later
    if (!handlerMap.has(worker)) {
      handlerMap.set(worker, new Map());
    }
    handlerMap.get(worker)!.set(handler, normalizedHandler);

    // @ts-ignore - Node.js Worker has different API
    worker.on(event, normalizedHandler);
  }
}

/**
 * Remove event listener from worker (compatible with both Web Workers and Node.js Worker Threads)
 */
export function removeListener(
  worker: Worker,
  event: "message" | "error",
  handler: EventHandler,
): void {
  if ("removeEventListener" in worker) {
    // Web Workers API (browser, Deno)
    worker.removeEventListener(event, handler);
  } else {
    // Node.js Worker Threads API
    // Get the normalized handler from the map
    const normalizedHandler = handlerMap.get(worker)?.get(handler) || handler;
    // @ts-ignore - Node.js Worker has different API
    worker.off(event, normalizedHandler);

    // Clean up the mapping
    handlerMap.get(worker)?.delete(handler);
  }
}
