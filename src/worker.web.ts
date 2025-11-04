// @ts-nocheck - Web Worker-specific file, skip in tsc --noEmit
// Workaround for Vitest browser mode: ensure wrapDynamicImport is available
// See: https://github.com/vitest-dev/vitest/issues/6552
if (typeof globalThis !== "undefined") {
  // @ts-ignore - Vitest browser mode global
  if (!globalThis.__vitest_browser_runner__) {
    // @ts-ignore
    globalThis.__vitest_browser_runner__ = { wrapDynamicImport: (f) => f() };
  }
}

import {
  type ParseRequest,
  createMessageHandler,
} from "#execution/worker/worker.shared.js";

/**
 * Web Worker implementation for CSV parsing.
 * Uses the Web Workers API (browser, Deno).
 *
 * @internal
 */

// Web Worker context (self)
const workerContext = self as unknown as DedicatedWorkerGlobalScope;

// Create message handler with Web Worker context
const messageHandler = createMessageHandler(workerContext);

// Register message listener (Web Workers API)
workerContext.addEventListener(
  "message",
  (event: MessageEvent<ParseRequest>) => {
    messageHandler(event.data);
  },
);
