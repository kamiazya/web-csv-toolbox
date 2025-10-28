import type {
  EngineConfig,
  EngineFallbackInfo,
  WorkerStrategy,
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
      this.workerURL = config.workerURL;
      this.workerPool = config.workerPool;
      this.onFallback = config.onFallback;
      this.parse(config);
    }

    this.applyDefaults();
    this.validate();
  }

  private parse(config: EngineConfig): void {
    if (config.worker) {
      this.bitmask |= EngineFlags.WORKER;
    }

    if (config.wasm) {
      this.bitmask |= EngineFlags.WASM;
    }

    if (config.workerStrategy === "stream-transfer") {
      this.bitmask |= EngineFlags.STREAM_TRANSFER;
    } else if (config.workerStrategy === "message-streaming") {
      this.bitmask |= EngineFlags.MESSAGE_STREAMING;
    }

    if (config.strict) {
      this.bitmask |= EngineFlags.STRICT;
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
   * Get worker strategy.
   */
  getWorkerStrategy(): WorkerStrategy | undefined {
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
    const fallbackConfig = new InternalEngineConfig();
    fallbackConfig.bitmask = this.bitmask;
    (fallbackConfig as any).workerURL = this.workerURL;
    (fallbackConfig as any).workerPool = this.workerPool;
    (fallbackConfig as any).onFallback = this.onFallback;

    // Stream transfer -> message streaming
    if (fallbackConfig.hasStreamTransfer()) {
      fallbackConfig.removeFlag(EngineFlags.STREAM_TRANSFER);
      fallbackConfig.addFlag(EngineFlags.MESSAGE_STREAMING);
    }

    // Disable strict mode
    if (fallbackConfig.hasStrict()) {
      fallbackConfig.removeFlag(EngineFlags.STRICT);
    }

    return fallbackConfig;
  }

  /**
   * Convert to EngineConfig.
   */
  toConfig(): EngineConfig {
    return {
      worker: this.hasWorker() || undefined,
      workerURL: this.workerURL,
      workerPool: this.workerPool,
      wasm: this.hasWasm() || undefined,
      workerStrategy: this.getWorkerStrategy(),
      strict: this.hasStrict() || undefined,
      onFallback: this.onFallback,
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
