/**
 * Efficient buffer pool for reusing memory allocations
 *
 * Reduces GC pressure during streaming operations.
 */

import { alignToU32 } from "@/webgpu/utils/alignToU32.ts";

/**
 * Efficient buffer pool for reusing memory allocations
 *
 * Reduces GC pressure during streaming operations.
 */
export class BufferPool {
  private pool: Uint8Array[] = [];
  private readonly maxPoolSize: number;
  private readonly bufferSize: number;

  constructor(bufferSize: number, maxPoolSize = 4) {
    this.bufferSize = alignToU32(bufferSize);
    this.maxPoolSize = maxPoolSize;
  }

  /**
   * Acquires a buffer from the pool or creates a new one
   */
  acquire(): Uint8Array {
    return this.pool.pop() || new Uint8Array(this.bufferSize);
  }

  /**
   * Returns a buffer to the pool for reuse
   */
  release(buffer: Uint8Array): void {
    if (
      this.pool.length < this.maxPoolSize &&
      buffer.length === this.bufferSize
    ) {
      this.pool.push(buffer);
    }
  }

  /**
   * Clears all buffers from the pool
   */
  clear(): void {
    this.pool = [];
  }
}
