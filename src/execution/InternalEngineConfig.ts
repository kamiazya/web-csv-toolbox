import type {
  EngineConfig,
  EngineFallbackInfo,
  WorkerCommunicationStrategy,
} from "../common/types.ts";
import type { WorkerPool } from "./worker/helpers/WorkerPool.ts";

/**
 * Engine flags bitmask (internal use).
 * @internal
 */
export enum EngineFlags {
  WORKER = 1 << 0, // 0b00001 = 1
  WASM = 1 << 1, // 0b00010 = 2
  STREAM_TRANSFER = 1 << 2, // 0b00100 = 4
  MESSAGE_STREAMING = 1 << 3, // 0b01000 = 8
  STRICT = 1 << 4, // 0b10000 = 16
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
  readonly workerURL?: string | URL;
  readonly workerPool?: WorkerPool;
  readonly onFallback?: (info: EngineFallbackInfo) => void;

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
    (instance as { workerURL?: string | URL }).workerURL = workerURL;
    (instance as { workerPool?: WorkerPool }).workerPool = workerPool;
    (
      instance as { onFallback?: (info: EngineFallbackInfo) => void }
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

    // strict requires stream-transfer
    if (this.hasStrict() && !this.hasStreamTransfer()) {
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
   * Add a flag.
   */
  private addFlag(flag: EngineFlags): void {
    this.bitmask |= flag;
  }

  /**
   * Remove a flag.
   */
  private removeFlag(flag: EngineFlags): void {
    this.bitmask &= ~flag;
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
   * Create a fallback configuration.
   *
   * Converts stream-transfer to message-streaming and disables strict mode.
   */
  createFallbackConfig(): InternalEngineConfig {
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
   * Convert to EngineConfig.
   */
  toConfig(): EngineConfig {
    const hasWorker = this.hasWorker();

    if (hasWorker) {
      return {
        worker: true,
        workerURL: this.workerURL,
        workerPool: this.workerPool,
        wasm: this.hasWasm() || undefined,
        workerStrategy: this.getWorkerStrategy(),
        strict: this.hasStrict() || undefined,
        onFallback: this.onFallback,
      };
    }

    return {
      worker: false,
      wasm: this.hasWasm() || undefined,
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
