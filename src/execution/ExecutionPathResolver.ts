/**
 * Execution path resolver for determining optimal execution strategy.
 *
 * @module
 */

import type { EnvironmentCapabilities } from "@/execution/EnvironmentCapabilities.ts";
import type {
  BackendType,
  ContextType,
  ExecutionPlan,
  InputType,
} from "@/execution/ExecutionPlan.ts";
import {
  BACKEND_PRIORITY,
  CONTEXT_PRIORITY,
  DEFAULT_OPTIMIZATION_HINT,
  GPU_CONFIG,
  type OptimizationHint,
} from "@/execution/OptimizationHint.ts";

/**
 * Minimal engine config interface for resolver.
 *
 * @remarks
 * This allows the resolver to work with InternalEngineConfig without
 * creating circular dependencies.
 */
export interface ResolverEngineConfig {
  /** Whether WASM is enabled */
  hasWasm(): boolean;

  /** Whether GPU is enabled */
  hasGpu(): boolean;

  /** Whether Worker is enabled */
  hasWorker(): boolean;

  /** Optimization hint */
  optimizationHint?: OptimizationHint;
}

/**
 * Context for execution path resolution.
 */
export interface ResolverContext {
  /** Input type being processed */
  inputType: InputType;

  /** Output format requested */
  outputFormat: "object" | "array";

  /** Character encoding (affects WASM/GPU compatibility) */
  charset?: string;

  /** Engine configuration */
  engineConfig: ResolverEngineConfig;

  /** Environment capabilities */
  capabilities: EnvironmentCapabilities;
}

/**
 * Resolves optimal execution paths based on input, output, environment, and hints.
 *
 * @example
 * ```typescript
 * const resolver = new ExecutionPathResolver();
 * const plan = resolver.resolve({
 *   inputType: "binary-stream",
 *   outputFormat: "object",
 *   engineConfig,
 *   capabilities,
 * });
 *
 * // plan.backends = ["gpu", "wasm", "js"] (for speed hint)
 * // plan.contexts = ["main", "worker-stream-transfer", "worker-message"]
 * ```
 */
export class ExecutionPathResolver {
  /**
   * Resolve execution plan with prioritized backends and contexts.
   *
   * @param ctx - Resolution context
   * @returns Execution plan with priority lists
   */
  resolve(ctx: ResolverContext): ExecutionPlan {
    const hint = ctx.engineConfig.optimizationHint ?? DEFAULT_OPTIMIZATION_HINT;

    // 1. Filter available backends and sort by hint priority
    const availableBackends = this.filterAvailableBackends(ctx);
    const sortedBackends = this.sortByPriority(
      availableBackends,
      BACKEND_PRIORITY[hint],
    );

    // 2. Filter available contexts and sort by hint priority
    const availableContexts = this.filterAvailableContexts(ctx);
    const sortedContexts = this.sortByPriority(
      availableContexts,
      CONTEXT_PRIORITY[hint],
    );

    // 3. Include GPU config if GPU is in the list
    const gpuConfig = sortedBackends.includes("gpu")
      ? GPU_CONFIG[hint]
      : undefined;

    return {
      backends: sortedBackends,
      contexts: sortedContexts,
      gpuConfig,
    };
  }

  /**
   * Filter backends based on environment and options.
   */
  private filterAvailableBackends(ctx: ResolverContext): BackendType[] {
    const backends: BackendType[] = ["js"]; // JS is always available
    const isUtf8 = this.isUtf8Charset(ctx.charset);

    // WASM: UTF-8 only, array format not supported
    if (ctx.engineConfig.hasWasm() && isUtf8 && ctx.outputFormat !== "array") {
      backends.push("wasm");
    }

    // GPU: UTF-8 only, environment must support it
    if (ctx.engineConfig.hasGpu() && isUtf8 && ctx.capabilities.gpu) {
      backends.push("gpu");
    }

    return backends;
  }

  /**
   * Filter contexts based on environment and input type.
   *
   * @remarks
   * Context selection is based on input type:
   * - Stream inputs → `worker-stream-transfer` only (message-streaming doesn't support ReadableStream)
   * - Non-stream inputs → `worker-message` only (natural fit for serializable data)
   *
   * This ensures the plan only advertises contexts that can actually execute.
   */
  private filterAvailableContexts(ctx: ResolverContext): ContextType[] {
    const contexts: ContextType[] = ["main"];
    const isStreamInput = ctx.inputType.endsWith("-stream");

    if (ctx.engineConfig.hasWorker()) {
      if (isStreamInput) {
        // Stream inputs: only stream-transfer is viable
        // (message-streaming does NOT support ReadableStream)
        if (ctx.capabilities.transferableStreams) {
          contexts.push("worker-stream-transfer");
        }
        // NOTE: Do NOT add worker-message for streams - it won't work
      } else {
        // Non-stream inputs: only worker-message is appropriate
        // (stream-transfer is unnecessary overhead for serializable data)
        contexts.push("worker-message");
      }
    }

    return contexts;
  }

  /**
   * Sort items by priority list.
   *
   * Items in the priority list come first in that order.
   * Items not in the priority list are moved to the end.
   */
  private sortByPriority<T>(items: T[], priority: T[]): T[] {
    return [...items].sort((a, b) => {
      const aIdx = priority.indexOf(a);
      const bIdx = priority.indexOf(b);
      // Items not in priority list go to the end
      const aOrder = aIdx === -1 ? Infinity : aIdx;
      const bOrder = bIdx === -1 ? Infinity : bIdx;
      return aOrder - bOrder;
    });
  }

  /**
   * Check if charset is UTF-8 (required for WASM/GPU).
   */
  private isUtf8Charset(charset?: string): boolean {
    if (!charset) return true; // Default is UTF-8
    const normalized = charset.toLowerCase().replace(/-/g, "");
    return normalized === "utf8";
  }
}
