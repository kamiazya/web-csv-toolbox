import { createWorker } from "#/worker/helpers/createWorker.js";
import {
  ReusableWorkerPool as ReusableWorkerPoolBase,
  type ReusableWorkerPoolOptions,
} from "./ReusableWorkerPool.shared.ts";

/**
 * Re-export the ReusableWorkerPool class with Node.js-specific createWorker.
 *
 * This wrapper ensures the Node.js version of createWorker is used.
 * All implementation details are in ReusableWorkerPool.shared.ts.
 */
export class ReusableWorkerPool extends ReusableWorkerPoolBase {
  constructor(options: ReusableWorkerPoolOptions = {}) {
    super(options, createWorker);
  }
}

// Re-export types
export type { ReusableWorkerPoolOptions };
