// @ts-nocheck - Node.js-specific file, skip in tsc --noEmit
import { parentPort } from "node:worker_threads";
import {
  createMessageHandler,
  type ParseRequest,
} from "./worker/helpers/worker.shared.js";

/**
 * Node.js Worker Threads implementation for CSV parsing.
 * Uses the Worker Threads API (Node.js).
 *
 * @internal
 */

if (!parentPort) {
  throw new Error("This module must be run in a Worker Thread context");
}

// Create message handler with Node.js Worker Threads context
const messageHandler = createMessageHandler(parentPort);

// Register message listener (Node.js Worker Threads API)
// In Node.js, message data is passed directly, not wrapped in event.data
parentPort.on("message", (message: ParseRequest) => {
  messageHandler(message);
});
