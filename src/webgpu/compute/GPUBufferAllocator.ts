/**
 * GPU Buffer Allocator
 *
 * Manages GPU buffer lifecycle: creation, resizing, and destruction.
 * Provides a clean interface for buffer operations.
 */

import { GPUMemoryError } from "./GPUMemoryError.ts";

/**
 * Configuration for a GPU buffer
 */
export interface GPUBufferConfig {
  /**
   * Initial size in bytes
   */
  size: number;

  /**
   * Buffer usage flags (e.g., GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST)
   */
  usage: GPUBufferUsageFlags;

  /**
   * Optional label for debugging
   */
  label?: string;

  /**
   * Whether the buffer is mapped at creation
   * @default false
   */
  mappedAtCreation?: boolean;
}

/**
 * Managed buffer entry
 */
interface ManagedBuffer {
  buffer: GPUBuffer;
  size: number;
  usage: GPUBufferUsageFlags;
  label?: string;
}

/**
 * GPU Buffer Allocator
 *
 * Provides centralized buffer management with:
 * - Named buffer registration
 * - Automatic resizing
 * - Bulk destruction
 *
 * @example
 * ```ts
 * const allocator = new GPUBufferAllocator(device);
 *
 * // Create buffers
 * allocator.create('input', {
 *   size: 1024,
 *   usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
 *   label: 'Input Buffer'
 * });
 *
 * // Get buffer
 * const inputBuffer = allocator.get('input');
 *
 * // Resize if needed
 * allocator.ensureSize('input', 2048);
 *
 * // Cleanup
 * allocator.destroyAll();
 * ```
 */
export class GPUBufferAllocator {
  private readonly device: GPUDevice;
  private readonly buffers = new Map<string, ManagedBuffer>();
  private destroyed = false;

  constructor(device: GPUDevice) {
    this.device = device;
  }

  /**
   * Create a new managed buffer
   *
   * @param name - Unique name for the buffer
   * @param config - Buffer configuration
   * @returns Created GPU buffer
   * @throws Error if name already exists or allocator is destroyed
   * @throws GPUMemoryError if buffer allocation fails due to memory pressure
   */
  create(name: string, config: GPUBufferConfig): GPUBuffer {
    this.assertNotDestroyed();

    if (this.buffers.has(name)) {
      throw new Error(`Buffer '${name}' already exists`);
    }

    try {
      const buffer = this.device.createBuffer({
        size: config.size,
        usage: config.usage,
        label: config.label,
        mappedAtCreation: config.mappedAtCreation,
      });

      this.buffers.set(name, {
        buffer,
        size: config.size,
        usage: config.usage,
        label: config.label,
      });

      return buffer;
    } catch (error) {
      // GPU buffer allocation failed - likely due to memory pressure
      // Throw a specific error type that can be caught by upper layers
      // to trigger fallback to WASM/JavaScript
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new GPUMemoryError(
        `Failed to allocate GPU buffer '${name}' (${config.size} bytes): ${errorMessage}`,
        {
          requestedSize: config.size,
          bufferName: name,
          cause: error instanceof Error ? error : undefined,
        }
      );
    }
  }

  /**
   * Get a managed buffer by name
   *
   * @param name - Buffer name
   * @returns GPU buffer
   * @throws Error if buffer doesn't exist
   */
  get(name: string): GPUBuffer {
    this.assertNotDestroyed();

    const managed = this.buffers.get(name);
    if (!managed) {
      throw new Error(`Buffer '${name}' not found`);
    }
    return managed.buffer;
  }

  /**
   * Check if a buffer exists
   *
   * @param name - Buffer name
   * @returns True if buffer exists
   */
  has(name: string): boolean {
    return this.buffers.has(name);
  }

  /**
   * Get buffer size
   *
   * @param name - Buffer name
   * @returns Buffer size in bytes
   * @throws Error if buffer doesn't exist
   */
  getSize(name: string): number {
    const managed = this.buffers.get(name);
    if (!managed) {
      throw new Error(`Buffer '${name}' not found`);
    }
    return managed.size;
  }

  /**
   * Ensure buffer has at least the specified size
   *
   * If current size is smaller, destroys and recreates the buffer.
   *
   * @param name - Buffer name
   * @param requiredSize - Minimum required size in bytes
   * @returns GPU buffer (may be new instance if resized)
   * @throws GPUMemoryError if buffer reallocation fails due to memory pressure
   */
  ensureSize(name: string, requiredSize: number): GPUBuffer {
    this.assertNotDestroyed();

    const managed = this.buffers.get(name);
    if (!managed) {
      throw new Error(`Buffer '${name}' not found`);
    }

    if (managed.size >= requiredSize) {
      return managed.buffer;
    }

    // Destroy old buffer and create new one
    managed.buffer.destroy();

    try {
      const newBuffer = this.device.createBuffer({
        size: requiredSize,
        usage: managed.usage,
        label: managed.label,
      });

      managed.buffer = newBuffer;
      managed.size = requiredSize;

      return newBuffer;
    } catch (error) {
      // GPU buffer reallocation failed - likely due to memory pressure
      // Note: Old buffer has been destroyed, so this allocator is now in an inconsistent state
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new GPUMemoryError(
        `Failed to reallocate GPU buffer '${name}' to ${requiredSize} bytes: ${errorMessage}`,
        {
          requestedSize: requiredSize,
          bufferName: name,
          cause: error instanceof Error ? error : undefined,
        }
      );
    }
  }

  /**
   * Destroy a specific buffer
   *
   * @param name - Buffer name
   * @returns True if buffer was destroyed, false if it didn't exist
   */
  destroy(name: string): boolean {
    const managed = this.buffers.get(name);
    if (!managed) {
      return false;
    }

    managed.buffer.destroy();
    this.buffers.delete(name);
    return true;
  }

  /**
   * Destroy all managed buffers
   */
  destroyAll(): void {
    for (const managed of this.buffers.values()) {
      managed.buffer.destroy();
    }
    this.buffers.clear();
    this.destroyed = true;
  }

  /**
   * Get all buffer names
   */
  getBufferNames(): string[] {
    return Array.from(this.buffers.keys());
  }

  /**
   * Check if allocator has been destroyed
   */
  get isDestroyed(): boolean {
    return this.destroyed;
  }

  private assertNotDestroyed(): void {
    if (this.destroyed) {
      throw new Error("GPUBufferAllocator has been destroyed");
    }
  }
}
