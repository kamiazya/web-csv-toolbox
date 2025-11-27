/**
 * Environment capabilities detection and caching.
 *
 * GPU detection is async, so this class initializes once and caches results.
 *
 * @module
 */

/**
 * Runtime environment capabilities.
 *
 * @remarks
 * GPU detection requires `navigator.gpu.requestAdapter()` which is async.
 * Use `getInstance()` for accurate GPU detection.
 * `getInstanceSync()` is for internal fallback only and returns GPU=false if not initialized.
 */
export class EnvironmentCapabilities {
  private static instance: EnvironmentCapabilities | null = null;
  private static initPromise: Promise<EnvironmentCapabilities> | null = null;

  private constructor(
    /** Whether WebGPU is available and adapter can be acquired */
    readonly gpu: boolean,
    /** Whether WebAssembly is available */
    readonly wasm: boolean,
    /** Whether TransferableStreams are supported */
    readonly transferableStreams: boolean,
  ) {}

  /**
   * Get singleton instance (async initialization on first call).
   *
   * @remarks
   * This is the recommended way to get capabilities.
   * First call performs GPU detection, subsequent calls return cached instance.
   */
  static async getInstance(): Promise<EnvironmentCapabilities> {
    if (EnvironmentCapabilities.instance)
      return EnvironmentCapabilities.instance;

    if (!EnvironmentCapabilities.initPromise) {
      EnvironmentCapabilities.initPromise =
        EnvironmentCapabilities.initialize();
    }
    return EnvironmentCapabilities.initPromise;
  }

  /**
   * Get singleton instance synchronously (conservative fallback).
   *
   * @remarks
   * If not initialized, returns conservative values (GPU=false).
   * Use this only for internal fallback scenarios.
   * Public APIs should always use `getInstance()`.
   *
   * @internal
   */
  static getInstanceSync(): EnvironmentCapabilities {
    if (EnvironmentCapabilities.instance)
      return EnvironmentCapabilities.instance;

    // Return conservative values if not initialized
    return new EnvironmentCapabilities(
      false, // GPU: unknown, assume false
      typeof WebAssembly !== "undefined",
      EnvironmentCapabilities.detectTransferableStreamsSync(),
    );
  }

  /**
   * Check if instance is already initialized.
   */
  static isInitialized(): boolean {
    return EnvironmentCapabilities.instance !== null;
  }

  /**
   * Reset singleton (for testing).
   *
   * @internal
   */
  static reset(): void {
    EnvironmentCapabilities.instance = null;
    EnvironmentCapabilities.initPromise = null;
  }

  private static async initialize(): Promise<EnvironmentCapabilities> {
    const [gpu, wasm, transferable] = await Promise.all([
      EnvironmentCapabilities.detectGPU(),
      Promise.resolve(typeof WebAssembly !== "undefined"),
      Promise.resolve(EnvironmentCapabilities.detectTransferableStreamsSync()),
    ]);

    EnvironmentCapabilities.instance = new EnvironmentCapabilities(
      gpu,
      wasm,
      transferable,
    );
    return EnvironmentCapabilities.instance;
  }

  private static async detectGPU(): Promise<boolean> {
    if (typeof navigator === "undefined" || !("gpu" in navigator)) {
      return false;
    }
    try {
      const adapter = await navigator.gpu.requestAdapter();
      return adapter !== null;
    } catch {
      return false;
    }
  }

  private static detectTransferableStreamsSync(): boolean {
    try {
      const stream = new ReadableStream();
      new MessageChannel().port1.postMessage(stream, [
        stream as unknown as Transferable,
      ]);
      return true;
    } catch {
      return false;
    }
  }
}

/**
 * Worker-specific environment capabilities.
 *
 * @remarks
 * Workers may have different GPU availability than main thread.
 * In Chrome, Workers can access WebGPU via `navigator.gpu`.
 */
export class WorkerEnvironmentCapabilities {
  private static instance: WorkerEnvironmentCapabilities | null = null;
  private static initPromise: Promise<WorkerEnvironmentCapabilities> | null =
    null;

  private constructor(
    /** Whether WebGPU is available in worker context */
    readonly gpu: boolean,
    /** Whether WebAssembly is available */
    readonly wasm: boolean,
  ) {}

  /**
   * Get singleton instance (async initialization on first call).
   */
  static async getInstance(): Promise<WorkerEnvironmentCapabilities> {
    if (WorkerEnvironmentCapabilities.instance)
      return WorkerEnvironmentCapabilities.instance;

    if (!WorkerEnvironmentCapabilities.initPromise) {
      WorkerEnvironmentCapabilities.initPromise =
        WorkerEnvironmentCapabilities.initialize();
    }
    return WorkerEnvironmentCapabilities.initPromise;
  }

  /**
   * Check if instance is already initialized.
   */
  static isInitialized(): boolean {
    return WorkerEnvironmentCapabilities.instance !== null;
  }

  /**
   * Reset singleton (for testing).
   *
   * @internal
   */
  static reset(): void {
    WorkerEnvironmentCapabilities.instance = null;
    WorkerEnvironmentCapabilities.initPromise = null;
  }

  private static async initialize(): Promise<WorkerEnvironmentCapabilities> {
    const [gpu, wasm] = await Promise.all([
      WorkerEnvironmentCapabilities.detectGPU(),
      Promise.resolve(typeof WebAssembly !== "undefined"),
    ]);

    WorkerEnvironmentCapabilities.instance = new WorkerEnvironmentCapabilities(
      gpu,
      wasm,
    );
    return WorkerEnvironmentCapabilities.instance;
  }

  private static async detectGPU(): Promise<boolean> {
    // Worker context may have navigator.gpu (Chrome supports this)
    if (typeof navigator === "undefined" || !("gpu" in navigator)) {
      return false;
    }
    try {
      const adapter = await navigator.gpu.requestAdapter();
      return adapter !== null;
    } catch {
      return false;
    }
  }
}
