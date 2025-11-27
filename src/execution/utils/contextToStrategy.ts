/**
 * Utility for converting ExecutionPlan contexts to WorkerStrategySelector format.
 *
 * @module
 */

import type { ContextType } from "@/execution/ExecutionPlan.ts";

/**
 * Worker strategy name used by WorkerStrategySelector.
 */
export type WorkerStrategyName = "stream-transfer" | "message-streaming";

/**
 * Convert ExecutionPlan.contexts to WorkerStrategySelector preferredStrategies.
 *
 * @param contexts - Context types from ExecutionPlan
 * @returns Array of strategy names for WorkerStrategySelector
 *
 * @example
 * ```typescript
 * const plan = resolver.resolve(ctx);
 * const preferredStrategies = contextsToPreferredStrategies(plan.contexts);
 * // ["stream-transfer", "message-streaming"]
 *
 * const strategy = strategySelector.selectWithPreference(engineConfig, {
 *   preferredStrategies,
 * });
 * ```
 */
export function contextsToPreferredStrategies(
  contexts: ContextType[],
): WorkerStrategyName[] {
  return contexts
    .filter(
      (c): c is "worker-stream-transfer" | "worker-message" => c !== "main",
    )
    .map((c) =>
      c === "worker-stream-transfer" ? "stream-transfer" : "message-streaming",
    );
}
