/**
 * Environment Capabilities Detection
 *
 * Detects available features in the current environment:
 * - WebGPU support
 * - WebAssembly support
 * - Transferable streams support
 * - Worker support
 *
 * Used by ExecutionPathResolver to determine which execution paths are available.
 */

/**
 * Environment capabilities
 */
export interface Capabilities {
  /**
   * Whether WebGPU is available and initialized
   */
  gpu: boolean;

  /**
   * Whether WebAssembly is supported
   */
  wasm: boolean;

  /**
   * Whether transferable streams are supported
   */
  transferableStreams: boolean;

  /**
   * Whether Web Workers are supported
   */
  worker: boolean;
}

/**
 * Environment Capabilities Detector (Singleton)
 *
 * Detects available features in the current environment.
 * Use `getInstance()` for async GPU detection or `getInstanceSync()` for conservative fallback.
 */
export class EnvironmentCapabilities {
  private static instance: EnvironmentCapabilities | null = null;
  private static instancePromise: Promise<EnvironmentCapabilities> | null =
    null;
  private static initialized = false;

  // Public readonly properties
  readonly gpu: boolean;
  readonly wasm: boolean;
  readonly transferableStreams: boolean;
  readonly worker: boolean;

  private constructor(capabilities: Capabilities) {
    this.gpu = capabilities.gpu;
    this.wasm = capabilities.wasm;
    this.transferableStreams = capabilities.transferableStreams;
    this.worker = capabilities.worker;
  }

  /**
   * Get singleton instance (async - performs GPU detection)
   *
   * This method asynchronously detects GPU support by attempting to request
   * a GPU adapter. Use this when you can afford the async overhead.
   *
   * @returns Promise resolving to EnvironmentCapabilities instance
   */
  static async getInstance(): Promise<EnvironmentCapabilities> {
    if (this.instance) {
      return this.instance;
    }

    if (this.instancePromise) {
      return this.instancePromise;
    }

    this.instancePromise = (async () => {
      const capabilities = await this.detectCapabilities();
      this.instance = new EnvironmentCapabilities(capabilities);
      this.initialized = true;
      return this.instance;
    })();

    return this.instancePromise;
  }

  /**
   * Get singleton instance (sync - conservative GPU detection)
   *
   * This method synchronously checks for GPU support by only checking if
   * `navigator.gpu` exists, without attempting to request an adapter.
   * This is conservative and may miss some GPU availability.
   *
   * Use this when you need immediate capabilities without async overhead.
   *
   * @returns EnvironmentCapabilities instance
   */
  static getInstanceSync(): EnvironmentCapabilities {
    if (this.instance) {
      return this.instance;
    }

    const capabilities = this.detectCapabilitiesSync();
    this.instance = new EnvironmentCapabilities(capabilities);
    this.initialized = true;
    return this.instance;
  }

  /**
   * Check if instance has been initialized
   *
   * @returns True if getInstance() or getInstanceSync() has been called
   */
  static isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * Reset singleton instance (for testing)
   */
  static reset(): void {
    this.instance = null;
    this.instancePromise = null;
    this.initialized = false;
  }

  /**
   * Reset singleton instance (alias for reset, for backward compatibility)
   * @deprecated Use reset() instead
   */
  static resetInstance(): void {
    this.reset();
  }

  /**
   * Detect environment capabilities (async - performs GPU adapter request)
   */
  private static async detectCapabilities(): Promise<Capabilities> {
    const wasm = this.detectWasm();
    const transferableStreams = this.detectTransferableStreams();
    const worker = this.detectWorker();

    // Async GPU detection - actually try to get an adapter with timeout
    let gpu = false;
    if (typeof navigator !== "undefined" && navigator.gpu) {
      try {
        // Add 3-second timeout to prevent hanging
        const adapter = await Promise.race([
          navigator.gpu.requestAdapter(),
          new Promise<null>((_, reject) =>
            setTimeout(() => reject(new Error("GPU detection timeout")), 3000)
          ),
        ]);
        gpu = adapter !== null;
      } catch {
        // Failed to detect GPU (timeout or error) - fallback to false
        gpu = false;
      }
    }

    return {
      gpu,
      wasm,
      transferableStreams,
      worker,
    };
  }

  /**
   * Detect environment capabilities (sync - conservative GPU check)
   */
  private static detectCapabilitiesSync(): Capabilities {
    const wasm = this.detectWasm();
    const transferableStreams = this.detectTransferableStreams();
    const worker = this.detectWorker();

    // Conservative GPU check - only check if navigator.gpu exists
    const gpu =
      typeof navigator !== "undefined" && navigator.gpu !== undefined;

    return {
      gpu,
      wasm,
      transferableStreams,
      worker,
    };
  }

  /**
   * Detect WebAssembly support
   */
  private static detectWasm(): boolean {
    try {
      return (
        typeof WebAssembly !== "undefined" &&
        typeof WebAssembly.instantiate === "function"
      );
    } catch {
      return false;
    }
  }

  /**
   * Detect transferable streams support
   */
  private static detectTransferableStreams(): boolean {
    try {
      // Check if ReadableStream is transferable
      // This is a heuristic - we check if the stream has a transfer method
      return (
        typeof ReadableStream !== "undefined" &&
        typeof ReadableStream.prototype !== "undefined" &&
        // Check for transferability by attempting to access the property
        // Modern browsers that support transferable streams will have this
        "transfer" in ReadableStream.prototype ||
        // Fallback: check for structure clone algorithm support
        typeof structuredClone === "function"
      );
    } catch {
      return false;
    }
  }

  /**
   * Detect Worker support
   */
  private static detectWorker(): boolean {
    try {
      return typeof Worker !== "undefined";
    } catch {
      return false;
    }
  }

  /**
   * Get capabilities as a plain object
   */
  getCapabilities(): Readonly<Capabilities> {
    return {
      gpu: this.gpu,
      wasm: this.wasm,
      transferableStreams: this.transferableStreams,
      worker: this.worker,
    };
  }

  /**
   * Check if GPU is available (method version for compatibility)
   */
  hasGPU(): boolean {
    return this.gpu;
  }

  /**
   * Check if WebAssembly is available (method version for compatibility)
   */
  hasWasm(): boolean {
    return this.wasm;
  }

  /**
   * Check if transferable streams are available (method version for compatibility)
   */
  hasTransferableStreams(): boolean {
    return this.transferableStreams;
  }

  /**
   * Check if Workers are available (method version for compatibility)
   */
  hasWorker(): boolean {
    return this.worker;
  }
}

/**
 * Worker Environment Capabilities (for use inside workers)
 *
 * Simplified version that doesn't check for Worker support
 * (since we're already inside a worker).
 */
export class WorkerEnvironmentCapabilities {
  private static instance: WorkerEnvironmentCapabilities | null = null;
  private static instancePromise: Promise<WorkerEnvironmentCapabilities> |
    null = null;
  private static initialized = false;

  // Public readonly properties
  readonly gpu: boolean;
  readonly wasm: boolean;

  private constructor(capabilities: Omit<Capabilities, "worker">) {
    this.gpu = capabilities.gpu;
    this.wasm = capabilities.wasm;
  }

  /**
   * Get singleton instance (async)
   */
  static async getInstance(): Promise<WorkerEnvironmentCapabilities> {
    if (this.instance) {
      return this.instance;
    }

    if (this.instancePromise) {
      return this.instancePromise;
    }

    this.instancePromise = (async () => {
      const capabilities = await this.detectCapabilities();
      this.instance = new WorkerEnvironmentCapabilities(capabilities);
      this.initialized = true;
      return this.instance;
    })();

    return this.instancePromise;
  }

  /**
   * Check if instance has been initialized
   */
  static isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * Reset singleton instance (for testing)
   */
  static reset(): void {
    this.instance = null;
    this.instancePromise = null;
    this.initialized = false;
  }

  private static async detectCapabilities(): Promise<
    Omit<Capabilities, "worker">
  > {
    const wasm = this.detectWasm();
    const transferableStreams = this.detectTransferableStreams();

    // Async GPU detection in worker context with timeout
    let gpu = false;
    if (typeof navigator !== "undefined" && navigator.gpu) {
      try {
        // Add 3-second timeout to prevent hanging
        const adapter = await Promise.race([
          navigator.gpu.requestAdapter(),
          new Promise<null>((_, reject) =>
            setTimeout(() => reject(new Error("GPU detection timeout")), 3000)
          ),
        ]);
        gpu = adapter !== null;
      } catch {
        // Failed to detect GPU (timeout or error) - fallback to false
        gpu = false;
      }
    }

    return {
      gpu,
      wasm,
      transferableStreams,
    };
  }

  private static detectWasm(): boolean {
    try {
      return (
        typeof WebAssembly !== "undefined" &&
        typeof WebAssembly.instantiate === "function"
      );
    } catch {
      return false;
    }
  }

  private static detectTransferableStreams(): boolean {
    try {
      return (
        typeof ReadableStream !== "undefined" &&
        typeof ReadableStream.prototype !== "undefined" &&
        ("transfer" in ReadableStream.prototype ||
          typeof structuredClone === "function")
      );
    } catch {
      return false;
    }
  }

  getCapabilities(): Readonly<Omit<Capabilities, "worker" | "transferableStreams">> {
    return {
      gpu: this.gpu,
      wasm: this.wasm,
    };
  }

  hasGPU(): boolean {
    return this.gpu;
  }

  hasWasm(): boolean {
    return this.wasm;
  }
}
