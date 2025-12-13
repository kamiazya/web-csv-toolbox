/**
 * Execution Path Resolver
 *
 * Selects the optimal execution strategy (backend + context) based on:
 * - User's engine configuration
 * - Environment capabilities
 * - Optimization hint
 * - Input type
 *
 * The resolver filters out unavailable options and orders remaining options
 * by the optimization hint's priority.
 */

import type { EnvironmentCapabilities } from "./EnvironmentCapabilities.ts";
import type {
  BackendType,
  ContextType,
  ExecutionPlan,
  InputType,
} from "./ExecutionPlan.ts";
import {
  BACKEND_PRIORITY,
  CONTEXT_PRIORITY,
  DEFAULT_OPTIMIZATION_HINT,
  GPU_CONFIG,
  type OptimizationHint,
} from "./OptimizationHint.ts";

/**
 * Minimal engine configuration interface
 *
 * This interface represents the minimal set of configuration needed
 * by the resolver. It's compatible with InternalEngineConfig but doesn't
 * require the full interface.
 */
export interface ResolverEngineConfig {
  /**
   * Check if Worker execution is enabled
   */
  hasWorker(): boolean;

  /**
   * Check if WebAssembly is enabled
   */
  hasWasm(): boolean;

  /**
   * Check if GPU is enabled
   */
  hasGpu(): boolean;

  /**
   * Get optimization hint
   */
  readonly optimizationHint?: OptimizationHint;
}

/**
 * Resolution context
 */
export interface ResolverContext {
  /**
   * Engine configuration
   */
  engineConfig: ResolverEngineConfig;

  /**
   * Environment capabilities
   */
  capabilities: EnvironmentCapabilities;

  /**
   * Input type (determines available contexts)
   */
  inputType: InputType;

  /**
   * Output format (for future use)
   * @optional
   */
  outputFormat?: "object" | "array";

  /**
   * Character encoding (for future use)
   * @optional
   */
  charset?: string;
}

/**
 * Execution Path Resolver
 *
 * Resolves the best execution plan based on configuration, capabilities,
 * and optimization hints.
 */
export class ExecutionPathResolver {
  /**
   * Resolve execution plan
   *
   * @param context - Resolution context
   * @returns Execution plan with ordered backends and contexts
   */
  resolve(context: ResolverContext): ExecutionPlan {
    const { engineConfig, capabilities, inputType, outputFormat, charset } =
      context;

    // Get optimization hint
    const hint = engineConfig.optimizationHint ?? DEFAULT_OPTIMIZATION_HINT;

    // Get priority-ordered backends and contexts
    const backendPriority = BACKEND_PRIORITY[hint];
    const contextPriority = CONTEXT_PRIORITY[hint];

    // Filter backends by availability
    const availableBackends = this.filterAvailableBackends(
      backendPriority,
      engineConfig,
      capabilities,
      outputFormat,
      charset,
    );

    // Filter contexts by availability
    const availableContexts = this.filterAvailableContexts(
      contextPriority,
      engineConfig,
      capabilities,
      inputType,
    );

    // Get GPU config if GPU is in the plan
    const gpuConfig = availableBackends.includes("gpu")
      ? GPU_CONFIG[hint]
      : undefined;

    return {
      backends: availableBackends,
      contexts: availableContexts,
      gpuConfig,
    };
  }

  /**
   * Filter backends by availability
   *
   * A backend is available if:
   * 1. It's enabled in the engine config
   * 2. It's supported by the environment
   * 3. It's compatible with the output format and charset
   */
  private filterAvailableBackends(
    priority: BackendType[],
    engineConfig: ResolverEngineConfig,
    capabilities: EnvironmentCapabilities,
    outputFormat?: "object" | "array",
    charset?: string,
  ): BackendType[] {
    return priority.filter((backend) => {
      switch (backend) {
        case "js":
          // JS is always available
          return true;

        case "wasm":
          // WASM requires both config and capability
          if (!engineConfig.hasWasm() || !capabilities.wasm) {
            return false;
          }
          // CRITICAL: Our WASM build requires SIMD128 support
          // Prevent runtime crashes in environments without SIMD (e.g., Safari < 16.4)
          if (!capabilities.wasmSimd) {
            return false;
          }
          // WASM doesn't support array output format
          if (outputFormat === "array") {
            return false;
          }
          // WASM only supports UTF-8
          if (charset && !this.isUtf8Compatible(charset)) {
            return false;
          }
          return true;

        case "gpu":
          // GPU requires both config and capability
          if (!engineConfig.hasGpu() || !capabilities.gpu) {
            return false;
          }
          // GPU only supports UTF-8
          if (charset && !this.isUtf8Compatible(charset)) {
            return false;
          }
          return true;

        default:
          return false;
      }
    });
  }

  /**
   * Filter contexts by availability
   *
   * A context is available if:
   * 1. It's enabled in the engine config (for worker contexts)
   * 2. It's supported by the environment
   * 3. It's compatible with the input type
   */
  private filterAvailableContexts(
    priority: ContextType[],
    engineConfig: ResolverEngineConfig,
    capabilities: EnvironmentCapabilities,
    inputType: InputType,
  ): ContextType[] {
    return priority.filter((context) => {
      switch (context) {
        case "main":
          // Main thread is always available
          return true;

        case "worker-stream-transfer":
          // Stream transfer requires:
          // - Worker enabled in config
          // - Worker support in environment
          // - Transferable streams support
          // - Stream input type
          return (
            engineConfig.hasWorker() &&
            capabilities.worker &&
            capabilities.transferableStreams &&
            this.isStreamInput(inputType)
          );

        case "worker-message":
          // Message passing requires:
          // - Worker enabled in config
          // - Worker support in environment
          // - Only for non-stream inputs (streams use worker-stream-transfer)
          if (!engineConfig.hasWorker() || !capabilities.worker) {
            return false;
          }
          // worker-message only supports non-stream inputs
          // (stream inputs must use worker-stream-transfer)
          if (this.isStreamInput(inputType)) {
            return false;
          }
          return true;

        default:
          return false;
      }
    });
  }

  /**
   * Check if input type is a stream
   */
  private isStreamInput(inputType: InputType): boolean {
    return inputType === "string-stream" || inputType === "binary-stream";
  }

  /**
   * Check if charset is UTF-8 compatible
   *
   * WASM and GPU backends only support UTF-8 encoding.
   * This method checks if the given charset is UTF-8 or a UTF-8 variant.
   */
  private isUtf8Compatible(charset: string): boolean {
    const normalized = charset.toLowerCase().replace(/[-_]/g, "");
    return (
      normalized === "utf8" ||
      normalized === "utf8bom" || // UTF-8 with BOM
      // Note: "unicode" is ambiguous (could be UTF-16, UTF-32, etc.)
      // Only accept explicit UTF-8 variants
      false
    );
  }

  /**
   * Determine input type from input value
   *
   * Utility method to help determine the input type from the actual input value.
   */
  static inferInputType(
    input: string | Uint8Array | ArrayBuffer | ReadableStream,
  ): InputType {
    if (input instanceof ReadableStream) {
      // For streams, we need to check the type of chunks
      // This is a heuristic - we assume binary streams are more common
      // In practice, the caller should know the stream type
      return "binary-stream";
    }

    if (typeof input === "string") {
      return "string";
    }

    if (input instanceof Uint8Array || input instanceof ArrayBuffer) {
      return "binary";
    }

    // Default fallback
    return "string";
  }
}
