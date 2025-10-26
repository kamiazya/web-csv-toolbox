/**
 * Worker thread execution implementations.
 * Uses Web Workers (browser/Deno) or Worker Threads (Node.js).
 *
 * @internal
 * @module
 */

export {
  parseStringInWorker,
  parseStringInWorkerWASM,
  terminateWorker,
} from "./parseStringInWorker.ts";
export {
  parseStreamInWorker,
  terminateWorker as terminateStreamWorker,
} from "./parseStreamInWorker.ts";
export {
  parseBinaryInWorker,
  parseBinaryInWorkerWASM,
  terminateWorker as terminateBinaryWorker,
} from "./parseBinaryInWorker.ts";
