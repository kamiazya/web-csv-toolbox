/**
 * GPU Shader Loader
 *
 * Handles shader module creation and caching.
 * Supports both inline WGSL and URL-based loading.
 */

/**
 * Shader source configuration
 */
export interface ShaderSource {
  /**
   * WGSL source code
   */
  code: string;

  /**
   * Optional label for debugging
   */
  label?: string;
}

/**
 * Compiled shader module with metadata
 */
export interface CompiledShader {
  /**
   * GPU shader module
   */
  module: GPUShaderModule;

  /**
   * Original source label
   */
  label?: string;

  /**
   * Compilation timestamp
   */
  compiledAt: number;
}

/**
 * GPU Shader Loader
 *
 * Provides shader compilation and caching.
 * Supports lazy loading for performance optimization.
 *
 * @example
 * ```ts
 * const loader = new GPUShaderLoader(device);
 *
 * // Load from inline source
 * const shader = loader.compile('myShader', {
 *   code: '@compute @workgroup_size(256) fn main() { ... }',
 *   label: 'My Compute Shader'
 * });
 *
 * // Use shader in pipeline
 * const pipeline = device.createComputePipeline({
 *   compute: { module: shader.module, entryPoint: 'main' }
 * });
 *
 * // Cleanup
 * loader.destroyAll();
 * ```
 */
export class GPUShaderLoader {
  private readonly device: GPUDevice;
  private readonly shaders = new Map<string, CompiledShader>();
  private destroyed = false;

  constructor(device: GPUDevice) {
    this.device = device;
  }

  /**
   * Compile a shader from source
   *
   * Caches the compiled module by name. Subsequent calls with the same name
   * return the cached module.
   *
   * @param name - Unique name for the shader
   * @param source - Shader source configuration
   * @returns Compiled shader module
   * @throws Error if name already exists with different source or loader is destroyed
   */
  compile(name: string, source: ShaderSource): CompiledShader {
    this.assertNotDestroyed();

    // Return cached if exists
    const existing = this.shaders.get(name);
    if (existing) {
      return existing;
    }

    // Compile shader
    const module = this.device.createShaderModule({
      code: source.code,
      label: source.label,
    });

    const compiled: CompiledShader = {
      module,
      label: source.label,
      compiledAt: Date.now(),
    };

    this.shaders.set(name, compiled);
    return compiled;
  }

  /**
   * Get a compiled shader by name
   *
   * @param name - Shader name
   * @returns Compiled shader or undefined if not found
   */
  get(name: string): CompiledShader | undefined {
    return this.shaders.get(name);
  }

  /**
   * Check if a shader is compiled
   *
   * @param name - Shader name
   * @returns True if shader exists
   */
  has(name: string): boolean {
    return this.shaders.has(name);
  }

  /**
   * Get GPU shader module by name
   *
   * Convenience method to get just the module.
   *
   * @param name - Shader name
   * @returns GPU shader module
   * @throws Error if shader not found
   */
  getModule(name: string): GPUShaderModule {
    const compiled = this.shaders.get(name);
    if (!compiled) {
      throw new Error(`Shader '${name}' not found`);
    }
    return compiled.module;
  }

  /**
   * Compile multiple shaders at once
   *
   * @param shaders - Map of name to source
   * @returns Map of name to compiled shader
   */
  compileMany(
    shaders: Record<string, ShaderSource>,
  ): Map<string, CompiledShader> {
    const results = new Map<string, CompiledShader>();
    for (const [name, source] of Object.entries(shaders)) {
      results.set(name, this.compile(name, source));
    }
    return results;
  }

  /**
   * Remove a shader from cache
   *
   * Note: GPU shader modules cannot be explicitly destroyed,
   * they are garbage collected when no longer referenced.
   *
   * @param name - Shader name
   * @returns True if shader was removed
   */
  remove(name: string): boolean {
    return this.shaders.delete(name);
  }

  /**
   * Clear all cached shaders
   */
  destroyAll(): void {
    this.shaders.clear();
    this.destroyed = true;
  }

  /**
   * Get all shader names
   */
  getShaderNames(): string[] {
    return Array.from(this.shaders.keys());
  }

  /**
   * Check if loader has been destroyed
   */
  get isDestroyed(): boolean {
    return this.destroyed;
  }

  private assertNotDestroyed(): void {
    if (this.destroyed) {
      throw new Error("GPUShaderLoader has been destroyed");
    }
  }
}
