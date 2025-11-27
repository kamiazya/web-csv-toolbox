import type {
  EngineConfig,
  EngineFallbackInfo,
  WorkerCommunicationStrategy,
  WorkerPool,
} from "@/core/types.ts";

/**
 * Engine flags bitmask (internal use).
 * @internal
 */
export enum EngineFlags {
  WORKER = 1 << 0, // 0b000001 = 1
  WASM = 1 << 1, // 0b000010 = 2
  STREAM_TRANSFER = 1 << 2, // 0b000100 = 4
  MESSAGE_STREAMING = 1 << 3, // 0b001000 = 8
  STRICT = 1 << 4, // 0b010000 = 16
}

/**
 * Internal engine configuration manager.
 *
 * Manages engine configuration using bitmask for efficient flag operations.
 *
 * @internal
 */
export class InternalEngineConfig {
  private bitmask = 0;
  readonly workerURL?: string | URL | undefined;
  readonly workerPool?: WorkerPool | undefined;
  readonly onFallback?: ((info: EngineFallbackInfo) => void) | undefined;

  constructor(config?: EngineConfig) {
    if (config) {
      // Extract worker-specific properties only if worker is enabled
      if (config.worker) {
        this.workerURL = config.workerURL;
        this.workerPool = config.workerPool;
        this.onFallback = config.onFallback;
      }
      this.parse(config);
    }

    this.applyDefaults();
    this.validate();
  }

  /**
   * Private constructor for cloning.
   */
  private static fromBitmask(
    bitmask: number,
    workerURL?: string | URL,
    workerPool?: WorkerPool,
    onFallback?: (info: EngineFallbackInfo) => void,
  ): InternalEngineConfig {
    const instance = Object.create(InternalEngineConfig.prototype);
    instance.bitmask = bitmask;
    (instance as { workerURL?: string | URL | undefined }).workerURL =
      workerURL;
    (instance as { workerPool?: WorkerPool | undefined }).workerPool =
      workerPool;
    (
      instance as {
        onFallback?: ((info: EngineFallbackInfo) => void) | undefined;
      }
    ).onFallback = onFallback;
    return instance;
  }

  private parse(config: EngineConfig): void {
    // Runtime validation for worker-specific properties
    // (TypeScript discriminated union prevents this at compile time)
    const anyConfig = config as any;
    if (!config.worker) {
      if (
        anyConfig.workerStrategy !== undefined &&
        anyConfig.workerStrategy !== false
      ) {
        throw new Error(
          "workerStrategy requires worker: true in engine config",
        );
      }
      if (anyConfig.strict !== undefined && anyConfig.strict !== false) {
        throw new Error(
          'strict requires workerStrategy: "stream-transfer" in engine config',
        );
      }
    }

    if (config.worker) {
      this.bitmask |= EngineFlags.WORKER;

      // Worker-specific properties
      if (config.workerStrategy === "stream-transfer") {
        this.bitmask |= EngineFlags.STREAM_TRANSFER;
      } else if (config.workerStrategy === "message-streaming") {
        this.bitmask |= EngineFlags.MESSAGE_STREAMING;
      }

      if (config.strict) {
        this.bitmask |= EngineFlags.STRICT;
      }
    }

    // Parse WASM configuration
    if (config.wasm) {
      this.bitmask |= EngineFlags.WASM;
    }
  }

  private applyDefaults(): void {
    // Worker without explicit strategy -> default to message-streaming
    if (
      this.hasWorker() &&
      !this.hasStreamTransfer() &&
      !this.hasMessageStreaming()
    ) {
      this.bitmask |= EngineFlags.MESSAGE_STREAMING;
    }
  }

  private validate(): void {
    // workerStrategy requires worker
    if (
      (this.hasStreamTransfer() || this.hasMessageStreaming()) &&
      !this.hasWorker()
    ) {
      throw new Error("workerStrategy requires worker: true in engine config");
    }

    // strict mode requires stream-transfer for worker
    if (this.hasWorker() && this.hasStrict() && !this.hasStreamTransfer()) {
      throw new Error(
        'strict requires workerStrategy: "stream-transfer" in engine config',
      );
    }
  }

  /**
   * Check if a flag is set.
   */
  private hasFlag(flag: EngineFlags): boolean {
    return (this.bitmask & flag) !== 0;
  }

  /**
   * Check if worker execution is enabled.
   */
  hasWorker(): boolean {
    return this.hasFlag(EngineFlags.WORKER);
  }

  /**
   * Check if WASM is enabled.
   */
  hasWasm(): boolean {
    return this.hasFlag(EngineFlags.WASM);
  }

  /**
   * Check if stream transfer is enabled.
   */
  hasStreamTransfer(): boolean {
    return this.hasFlag(EngineFlags.STREAM_TRANSFER);
  }

  /**
   * Check if message streaming is enabled.
   */
  hasMessageStreaming(): boolean {
    return this.hasFlag(EngineFlags.MESSAGE_STREAMING);
  }

  /**
   * Check if strict mode is enabled.
   */
  hasStrict(): boolean {
    return this.hasFlag(EngineFlags.STRICT);
  }

  /**
   * Get worker communication strategy.
   */
  getWorkerStrategy(): WorkerCommunicationStrategy | undefined {
    if (this.hasStreamTransfer()) {
      return "stream-transfer";
    }
    if (this.hasMessageStreaming()) {
      return "message-streaming";
    }
    return undefined;
  }

  /**
   * Create a fallback configuration for worker.
   *
   * Converts stream-transfer to message-streaming and disables worker strict mode.
   */
  createWorkerFallbackConfig(): InternalEngineConfig {
    let fallbackBitmask = this.bitmask;

    // Stream transfer -> message streaming
    if ((fallbackBitmask & EngineFlags.STREAM_TRANSFER) !== 0) {
      fallbackBitmask &= ~EngineFlags.STREAM_TRANSFER;
      fallbackBitmask |= EngineFlags.MESSAGE_STREAMING;
    }

    // Disable strict mode
    if ((fallbackBitmask & EngineFlags.STRICT) !== 0) {
      fallbackBitmask &= ~EngineFlags.STRICT;
    }

    return InternalEngineConfig.fromBitmask(
      fallbackBitmask,
      this.workerURL,
      this.workerPool,
      this.onFallback,
    );
  }

  /**
   * Create a fallback configuration for WASM.
   *
   * Disables WASM.
   */
  createWasmFallbackConfig(): InternalEngineConfig {
    let fallbackBitmask = this.bitmask;

    // Disable WASM
    if ((fallbackBitmask & EngineFlags.WASM) !== 0) {
      fallbackBitmask &= ~EngineFlags.WASM;
    }

    return InternalEngineConfig.fromBitmask(
      fallbackBitmask,
      this.workerURL,
      this.workerPool,
      this.onFallback,
    );
  }

  /**
   * Convert to EngineConfig.
   */
  toConfig(): EngineConfig {
    const hasWorker = this.hasWorker();
    const hasWasm = this.hasWasm();

    if (hasWorker) {
      const baseWorkerConfig = {
        worker: true as const,
        wasm: hasWasm,
        workerStrategy: this.getWorkerStrategy(),
        strict: this.hasStrict(),
        onFallback: this.onFallback,
      };

      // Return appropriate variant based on what's set
      // workerPool and workerURL are mutually exclusive
      if (this.workerPool !== undefined) {
        return {
          ...baseWorkerConfig,
          workerPool: this.workerPool,
          workerURL: undefined,
        };
      }
      if (this.workerURL !== undefined) {
        return {
          ...baseWorkerConfig,
          workerURL: this.workerURL,
          workerPool: undefined,
        };
      }
      // Default: neither workerPool nor workerURL
      return {
        ...baseWorkerConfig,
        workerURL: undefined,
        workerPool: undefined,
      };
    }

    return {
      worker: false,
      wasm: hasWasm,
    };
  }

  /**
   * Get bitmask for debugging.
   * @internal
   */
  getBitmask(): number {
    return this.bitmask;
  }

  /**
   * String representation for debugging.
   */
  toString(): string {
    const parts: string[] = [];
    if (this.hasWorker()) parts.push("worker");
    if (this.hasWasm()) parts.push("wasm");
    if (this.hasStreamTransfer()) parts.push("stream-transfer");
    if (this.hasMessageStreaming()) parts.push("message-streaming");
    if (this.hasStrict()) parts.push("strict");
    return parts.join(" + ") || "main";
  }
}
