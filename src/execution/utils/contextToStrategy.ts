/**
 * Context to Strategy Utility
 *
 * Converts execution context types to worker strategy names.
 * This bridges the execution planning system with the existing worker strategy system.
 */

import type { ContextType } from "../ExecutionPlan.ts";

/**
 * Worker strategy name
 *
 * These correspond to the strategy names used in WorkerStrategySelector.
 */
export type WorkerStrategyName = "stream-transfer" | "message-streaming";

/**
 * Convert context types to preferred worker strategies
 *
 * Takes an ordered list of context types and converts them to worker strategy names.
 * Non-worker contexts are filtered out.
 *
 * @param contexts - Ordered list of context types
 * @returns Ordered list of worker strategy names
 *
 * @example
 * ```ts
 * const contexts: ContextType[] = ["worker-stream-transfer", "main", "worker-message"];
 * const strategies = contextsToPreferredStrategies(contexts);
 * // strategies = ["stream-transfer", "message-streaming"]
 * ```
 */
export function contextsToPreferredStrategies(
  contexts: ContextType[],
): WorkerStrategyName[] {
  const strategies: WorkerStrategyName[] = [];

  for (const context of contexts) {
    if (context === "worker-stream-transfer") {
      strategies.push("stream-transfer");
    } else if (context === "worker-message") {
      strategies.push("message-streaming");
    }
    // "main" context is skipped - doesn't map to a worker strategy
  }

  return strategies;
}

/**
 * Check if a context type is a worker context
 *
 * @param context - Context type to check
 * @returns True if the context is a worker context
 */
export function isWorkerContext(context: ContextType): boolean {
  return context === "worker-stream-transfer" || context === "worker-message";
}

/**
 * Get the primary (most preferred) worker strategy
 *
 * @param contexts - Ordered list of context types
 * @returns Primary worker strategy name, or undefined if no worker contexts
 */
export function getPrimaryWorkerStrategy(
  contexts: ContextType[],
): WorkerStrategyName | undefined {
  const strategies = contextsToPreferredStrategies(contexts);
  return strategies[0];
}
