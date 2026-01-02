/**
 * CSV Indexing Backend
 *
 * WebGPU-based CSV separator detection using a two-pass algorithm.
 * Implements the GPUComputeBackend interface for consistent GPU compute operations.
 */

// Import WGSL shader templates
import { DEFAULT_QUOTATION } from "@/core/constants.ts";
import pass1ShaderTemplate from "@/parser/webgpu/indexing/shaders/csv-indexer-pass1.wgsl?raw";
import pass2ShaderTemplate from "@/parser/webgpu/indexing/shaders/csv-indexer-pass2.wgsl?raw";
import type {
  CSVSeparatorIndexResult,
  ParseUniforms,
} from "@/parser/webgpu/indexing/types.ts";

/**
 * Internal result type from GPU parsing operation
 * Used for GPUComputeBackend interface implementation
 */
interface GPUParseResult {
  /** Array of separator positions (packed as u32: offset | type << 31) */
  readonly sepIndices: Uint32Array;
  /** Quote state at the end of the chunk (0: false, 1: true) */
  readonly endInQuote: number;
  /** Total number of separators found */
  readonly sepCount: number;
}

import {
  getProcessedBytesCount,
  sortSeparatorsByOffset,
} from "@/parser/webgpu/utils/separator-utils.ts";
import { GPUBufferAllocator } from "@/webgpu/compute/GPUBufferAllocator.ts";
import type {
  ComputeDispatchResult,
  ComputeTiming,
  GPUComputeBackend,
} from "@/webgpu/compute/GPUComputeBackend.ts";
import { GPUMemoryError } from "@/webgpu/compute/GPUMemoryError.ts";
import { alignToU32 } from "@/webgpu/utils/alignToU32.ts";
import { padToU32Aligned } from "@/webgpu/utils/padToU32Aligned.ts";
import {
  DEFAULT_WORKGROUP_SIZE,
  selectOptimalWorkgroupSize,
  validateWorkgroupSize,
  type WorkgroupSize,
} from "@/webgpu/utils/workgroupSize.ts";

// Re-export workgroup size utilities for backward compatibility
export {
  DEFAULT_WORKGROUP_SIZE,
  SUPPORTED_WORKGROUP_SIZES,
  selectOptimalWorkgroupSize,
  selectOptimalWorkgroupSizeFromGPU,
  validateWorkgroupSize,
  type WorkgroupSize,
} from "@/webgpu/utils/workgroupSize.ts";

/**
 * Default chunk size for CSV processing (1MB)
 */
const DEFAULT_CHUNK_SIZE = 1024 * 1024;

/**
 * Enable debug timing logs for benchmarking
 * Set to true only during development/benchmarking
 */
const DEBUG_TIMING = false;

/**
 * Configuration for CSV Separator Indexing Backend
 */
export interface CSVSeparatorIndexingBackendConfig {
  /**
   * Chunk size for processing
   * @default 1MB (1024 * 1024)
   */
  chunkSize?: number;

  /**
   * Maximum number of separators to detect per chunk
   * @default chunkSize (worst case: every byte is a separator)
   */
  maxSeparators?: number;

  /**
   * GPU instance (for environments without navigator.gpu)
   */
  gpu?: GPU;

  /**
   * Pre-existing GPU device to use
   * If provided, the backend will not create or destroy the device
   */
  device?: GPUDevice;

  /**
   * Enable timing instrumentation
   * @default false
   */
  enableTiming?: boolean;

  /**
   * Workgroup size for GPU compute.
   * Must be a power of 2: 32, 64, 128, 256, or 512.
   * Higher values may be more efficient on some GPUs but must not exceed
   * the device's maxComputeWorkgroupSizeX limit.
   * If not specified (undefined), automatically selects optimal size based on GPU limits.
   * @default auto (selects optimal size based on GPU limits)
   */
  workgroupSize?: WorkgroupSize;

  /**
   * Quotation character used for escaping field values.
   * Must be a single ASCII character (code 0-127).
   * @default '"' (double quote, ASCII 34)
   */
  quotation?: string;

  /**
   * Field delimiter character used for CSV parsing.
   * Must be a single ASCII character (code 0-127).
   * Must not be CR (13) or LF (10) - reserved for line endings.
   * Must not match quotation character.
   * @default ',' (comma, ASCII 44)
   */
  delimiter?: string;
}

/**
 * Shader template parameters for placeholder replacement
 */
interface ShaderTemplateParams {
  workgroupSize: WorkgroupSize;
  logIterations: number;
}

/**
 * Replace placeholders in shader template with actual values
 *
 * @param template - Shader template string with {{PLACEHOLDER}} markers
 * @param params - Values to substitute for placeholders
 * @returns Shader code with placeholders replaced
 */
function applyShaderTemplate(
  template: string,
  params: ShaderTemplateParams,
): string {
  return template
    .replace(/\{\{WORKGROUP_SIZE\}\}/g, String(params.workgroupSize))
    .replace(/\{\{LOG_ITERATIONS\}\}/g, String(params.logIterations));
}

/**
 * Generate Pass 1 shader with configurable workgroup size
 */
function generatePass1Shader(workgroupSize: WorkgroupSize): string {
  return applyShaderTemplate(pass1ShaderTemplate, {
    workgroupSize,
    logIterations: Math.log2(workgroupSize),
  });
}

/**
 * Generate Pass 2 shader with configurable workgroup size
 */
function generatePass2Shader(workgroupSize: WorkgroupSize): string {
  return applyShaderTemplate(pass2ShaderTemplate, {
    workgroupSize,
    logIterations: Math.log2(workgroupSize),
  });
}

/**
 * Internal buffer names for the CSV indexing backend
 */
const BUFFER_NAMES = {
  INPUT: "input",
  SEP_INDICES: "sepIndices",
  ATOMIC_INDEX: "atomicIndex",
  UNIFORMS: "uniforms",
  RESULT_META: "resultMeta",
  WORKGROUP_XORS: "workgroupXORs",
} as const;

/**
 * CSV Indexing Backend
 *
 * GPU-accelerated CSV separator detection using a two-pass algorithm.
 *
 * **Two-Pass Algorithm:**
 * - Pass 1: Collect quote parity for each workgroup (256 bytes)
 * - CPU: Compute prefix XOR across workgroups
 * - Pass 2: Detect separators using CPU-computed quote state
 *
 * **Features:**
 * - Correct quote state propagation for fields of any length
 * - Ordered separator writes (no CPU-side sorting)
 * - Race-free separator counting via atomic operations
 * - AsyncDisposable support for automatic resource cleanup
 *
 * @example
 * ```ts
 * // Recommended: use create() with await using for automatic cleanup
 * await using backend = await CSVSeparatorIndexingBackend.create();
 * const result = await backend.run(csvBytes, false);
 * console.log(`Found ${result.sepCount} separators`);
 * // backend is automatically destroyed when scope exits
 * ```
 *
 * @example
 * ```ts
 * // Manual lifecycle management (legacy)
 * const backend = new CSVSeparatorIndexingBackend();
 * try {
 *   await backend.initialize();
 *   const result = await backend.run(csvBytes, false);
 * } finally {
 *   await backend.destroy();
 * }
 * ```
 */
export class CSVSeparatorIndexingBackend
  implements GPUComputeBackend<Uint8Array, ParseUniforms, GPUParseResult>
{
  private device: GPUDevice | null = null;
  private bufferAllocator: GPUBufferAllocator | null = null;
  private pass1ShaderModule: GPUShaderModule | null = null;
  private pass2ShaderModule: GPUShaderModule | null = null;

  private pass1Pipeline: GPUComputePipeline | null = null;
  private pass2Pipeline: GPUComputePipeline | null = null;
  private pass1BindGroupLayout: GPUBindGroupLayout | null = null;
  private pass2BindGroupLayout: GPUBindGroupLayout | null = null;
  private pass1BindGroup: GPUBindGroup | null = null;
  private pass2BindGroup: GPUBindGroup | null = null;

  private readonly config: Required<
    Omit<
      CSVSeparatorIndexingBackendConfig,
      "gpu" | "device" | "workgroupSize" | "quotation" | "delimiter"
    >
  > & {
    gpu?: GPU;
    device?: GPUDevice;
    workgroupSize?: WorkgroupSize; // undefined means "auto"
    quotation: string; // quotation character
    delimiter: string; // field delimiter character
  };
  private resolvedWorkgroupSize: WorkgroupSize | null = null;
  private readonly ownDevice: boolean;
  private initialized = false;
  private currentBufferSize = 0;

  constructor(config: CSVSeparatorIndexingBackendConfig = {}) {
    const chunkSize = config.chunkSize || DEFAULT_CHUNK_SIZE;
    const quotation = config.quotation ?? DEFAULT_QUOTATION;
    const delimiter = config.delimiter ?? ",";

    // Validate quotation character
    if (quotation.length !== 1) {
      throw new Error(
        `Quotation must be a single character, got: ${quotation}`,
      );
    }
    const quotationCode = quotation.charCodeAt(0);
    if (quotationCode < 0 || quotationCode > 127) {
      throw new Error(
        `Quotation must be an ASCII character (0-127), got: "${quotation}" (code: ${quotationCode})`,
      );
    }

    // Validate delimiter character
    if (delimiter.length !== 1) {
      throw new Error(
        `Delimiter must be a single character, got: ${delimiter}`,
      );
    }
    const delimiterCode = delimiter.charCodeAt(0);
    if (delimiterCode < 0 || delimiterCode > 127) {
      throw new Error(
        `Delimiter must be an ASCII character (0-127), got: "${delimiter}" (code: ${delimiterCode})`,
      );
    }
    if (delimiterCode === 13 || delimiterCode === 10) {
      throw new Error(
        `Delimiter must not be CR (13) or LF (10), got: "${delimiter}" (code: ${delimiterCode})`,
      );
    }

    // Validate delimiter and quotation do not conflict
    if (delimiter === quotation) {
      throw new Error(
        `Delimiter and quotation must be different characters, both are: "${delimiter}"`,
      );
    }

    // Validate workgroup size if specified
    if (config.workgroupSize !== undefined) {
      validateWorkgroupSize(config.workgroupSize);
    }

    this.config = {
      chunkSize: alignToU32(chunkSize),
      maxSeparators: config.maxSeparators ?? chunkSize,
      gpu: config.gpu,
      device: config.device,
      enableTiming: config.enableTiming ?? false,
      workgroupSize: config.workgroupSize, // undefined means "auto"
      quotation,
      delimiter,
    };
    this.ownDevice = !config.device;
  }

  /**
   * Create and initialize a new CSVSeparatorIndexingBackend
   *
   * This is the recommended way to create a backend instance.
   * Combines construction and initialization into a single async call,
   * making it easy to use with `await using` for automatic resource cleanup.
   *
   * @param config - Backend configuration options
   * @returns Initialized backend ready for use
   * @throws Error if GPU initialization fails
   *
   * @example
   * ```ts
   * // Recommended: automatic resource management
   * await using backend = await CSVSeparatorIndexingBackend.create();
   * const result = await backend.run(data, false);
   * // backend is automatically destroyed when scope exits
   * ```
   *
   * @example
   * ```ts
   * // With custom configuration
   * await using backend = await CSVSeparatorIndexingBackend.create({
   *   chunkSize: 2 * 1024 * 1024,
   *   workgroupSize: 256,
   * });
   * ```
   */
  static async create(
    config: CSVSeparatorIndexingBackendConfig = {},
  ): Promise<CSVSeparatorIndexingBackend> {
    const backend = new CSVSeparatorIndexingBackend(config);
    await backend.initialize();
    return backend;
  }

  /**
   * Get the resolved workgroup size.
   * Returns the configured size, or the auto-selected size after initialization.
   * If undefined (auto) is configured and backend is not yet initialized, returns DEFAULT_WORKGROUP_SIZE.
   */
  get workgroupSize(): WorkgroupSize {
    if (this.resolvedWorkgroupSize !== null) {
      return this.resolvedWorkgroupSize;
    }
    // Return configured size or default if auto (undefined)
    return this.config.workgroupSize ?? DEFAULT_WORKGROUP_SIZE;
  }

  /**
   * Check if backend is initialized and ready
   */
  get isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * Get the field delimiter character
   */
  get delimiter(): string {
    return this.config.delimiter;
  }

  /**
   * Get the maximum safe chunk size for a single GPU dispatch
   *
   * Calculated from GPU device limits:
   * - maxComputeWorkgroupsPerDimension (default: 65535)
   * - workgroupSize (resolved value, default: 256)
   *
   * @returns Maximum chunk size in bytes, or default if device not initialized
   */
  getMaxChunkSize(): number {
    const wgSize = this.workgroupSize;
    if (!this.device) {
      // Fallback to conservative default (65535 * workgroupSize)
      return 65535 * wgSize;
    }
    const maxWorkgroups = this.device.limits.maxComputeWorkgroupsPerDimension;
    return maxWorkgroups * wgSize;
  }

  /**
   * Initialize the backend
   *
   * Sets up GPU device, compiles shaders, creates pipelines.
   * If workgroupSize is undefined, selects optimal size based on device limits.
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    // Get or create GPU device
    if (this.config.device) {
      this.device = this.config.device;
      // Resolve workgroup size using device limits
      this.resolvedWorkgroupSize =
        this.config.workgroupSize ?? selectOptimalWorkgroupSize(this.device);
    } else {
      const gpu =
        this.config.gpu ??
        (typeof navigator !== "undefined" ? navigator.gpu : undefined);
      if (!gpu) {
        throw new Error("WebGPU is not supported in this environment");
      }

      const adapter = await gpu.requestAdapter();
      if (!adapter) {
        throw new Error("Failed to get GPU adapter");
      }

      // Determine the workgroup size to use
      const requestedWgSize = this.config.workgroupSize;

      // If workgroup size is specified and > 256, we need to request higher limits
      const requiredLimits: GPUDeviceDescriptor["requiredLimits"] = {};
      if (requestedWgSize !== undefined && requestedWgSize > 256) {
        // Check if adapter supports the requested size
        if (requestedWgSize > adapter.limits.maxComputeWorkgroupSizeX) {
          throw new Error(
            `Requested workgroup size ${requestedWgSize} exceeds adapter limit ${adapter.limits.maxComputeWorkgroupSizeX}`,
          );
        }
        if (
          requestedWgSize > adapter.limits.maxComputeInvocationsPerWorkgroup
        ) {
          throw new Error(
            `Requested workgroup size ${requestedWgSize} exceeds adapter's maxComputeInvocationsPerWorkgroup limit ${adapter.limits.maxComputeInvocationsPerWorkgroup}`,
          );
        }
        requiredLimits.maxComputeWorkgroupSizeX = requestedWgSize;
        requiredLimits.maxComputeInvocationsPerWorkgroup = requestedWgSize;
      }

      this.device = await adapter.requestDevice({ requiredLimits });

      // Resolve workgroup size: use configured value or auto-select
      if (requestedWgSize !== undefined) {
        this.resolvedWorkgroupSize = requestedWgSize;
      } else {
        // Auto-select: use the largest supported size within device limits
        this.resolvedWorkgroupSize = selectOptimalWorkgroupSize(this.device);
      }
    }

    // Initialize buffer allocator
    this.bufferAllocator = new GPUBufferAllocator(this.device);

    // Generate and compile shaders with resolved workgroup size
    const wgSize = this.resolvedWorkgroupSize;
    this.pass1ShaderModule = this.device.createShaderModule({
      code: generatePass1Shader(wgSize),
      label: `CSV Indexer Pass 1 Shader (WG=${wgSize})`,
    });
    this.pass2ShaderModule = this.device.createShaderModule({
      code: generatePass2Shader(wgSize),
      label: `CSV Indexer Pass 2 Shader (WG=${wgSize})`,
    });

    // Create bind group layouts and pipelines
    this.createPipelines();

    this.initialized = true;
  }

  /**
   * Create compute pipelines for both passes
   */
  private createPipelines(): void {
    if (!this.device || !this.pass1ShaderModule || !this.pass2ShaderModule) {
      throw new Error("Device or shader modules not initialized");
    }

    // Pass 1: Collect workgroup quote parities
    this.pass1BindGroupLayout = this.device.createBindGroupLayout({
      label: "CSV Indexer Pass 1 Bind Group Layout",
      entries: [
        {
          binding: 0,
          visibility: GPUShaderStage.COMPUTE,
          buffer: { type: "read-only-storage" }, // inputBytes
        },
        {
          binding: 1,
          visibility: GPUShaderStage.COMPUTE,
          buffer: { type: "storage" }, // workgroupXORs
        },
        {
          binding: 2,
          visibility: GPUShaderStage.COMPUTE,
          buffer: { type: "uniform" }, // uniforms
        },
      ],
    });

    const pass1PipelineLayout = this.device.createPipelineLayout({
      label: "CSV Indexer Pass 1 Pipeline Layout",
      bindGroupLayouts: [this.pass1BindGroupLayout],
    });

    this.pass1Pipeline = this.device.createComputePipeline({
      label: "CSV Indexer Pass 1 Pipeline",
      layout: pass1PipelineLayout,
      compute: {
        module: this.pass1ShaderModule,
        entryPoint: "main",
      },
    });

    // Pass 2: Detect separators with CPU-computed quote states
    this.pass2BindGroupLayout = this.device.createBindGroupLayout({
      label: "CSV Indexer Pass 2 Bind Group Layout",
      entries: [
        {
          binding: 0,
          visibility: GPUShaderStage.COMPUTE,
          buffer: { type: "read-only-storage" }, // inputBytes
        },
        {
          binding: 1,
          visibility: GPUShaderStage.COMPUTE,
          buffer: { type: "storage" }, // sepIndices
        },
        {
          binding: 2,
          visibility: GPUShaderStage.COMPUTE,
          buffer: { type: "storage" }, // atomicIndex
        },
        {
          binding: 3,
          visibility: GPUShaderStage.COMPUTE,
          buffer: { type: "uniform" }, // uniforms
        },
        {
          binding: 4,
          visibility: GPUShaderStage.COMPUTE,
          buffer: { type: "storage" }, // resultMeta
        },
        {
          binding: 5,
          visibility: GPUShaderStage.COMPUTE,
          buffer: { type: "read-only-storage" }, // workgroupPrefixXORs
        },
      ],
    });

    const pass2PipelineLayout = this.device.createPipelineLayout({
      label: "CSV Indexer Pass 2 Pipeline Layout",
      bindGroupLayouts: [this.pass2BindGroupLayout],
    });

    this.pass2Pipeline = this.device.createComputePipeline({
      label: "CSV Indexer Pass 2 Pipeline",
      layout: pass2PipelineLayout,
      compute: {
        module: this.pass2ShaderModule,
        entryPoint: "main",
      },
    });
  }

  /**
   * Create or resize buffers for processing
   *
   * @throws GPUMemoryError if buffer allocation fails due to memory pressure
   */
  private ensureBuffers(requiredSize: number): void {
    if (!this.device || !this.bufferAllocator) {
      throw new Error("Backend not initialized");
    }

    const alignedSize = alignToU32(requiredSize);

    if (this.currentBufferSize >= alignedSize) {
      return; // Buffers are already large enough
    }

    // Destroy existing buffers if any
    if (this.currentBufferSize > 0) {
      this.bufferAllocator.destroyAll();
      this.bufferAllocator = new GPUBufferAllocator(this.device);
    }

    try {
      // Create input buffer
      this.bufferAllocator.create(BUFFER_NAMES.INPUT, {
        size: alignedSize,
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
        label: "Input Buffer",
      });

      // Create separator indices buffer
      const actualMaxSeparators = Math.max(
        this.config.maxSeparators,
        alignedSize,
      );
      this.bufferAllocator.create(BUFFER_NAMES.SEP_INDICES, {
        size: actualMaxSeparators * 4,
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC,
        label: "Separator Indices Buffer",
      });

      // Create atomic counter buffer
      this.bufferAllocator.create(BUFFER_NAMES.ATOMIC_INDEX, {
        size: 4,
        usage:
          GPUBufferUsage.STORAGE |
          GPUBufferUsage.COPY_SRC |
          GPUBufferUsage.COPY_DST,
        label: "Atomic Index Buffer",
      });

      // Create uniforms buffer
      this.bufferAllocator.create(BUFFER_NAMES.UNIFORMS, {
        size: 16,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
        label: "Uniforms Buffer",
      });

      // Create result metadata buffer
      this.bufferAllocator.create(BUFFER_NAMES.RESULT_META, {
        size: 16,
        usage:
          GPUBufferUsage.STORAGE |
          GPUBufferUsage.COPY_SRC |
          GPUBufferUsage.COPY_DST,
        label: "Result Meta Buffer",
      });

      // Create workgroup XORs buffer
      const maxWorkgroups = Math.ceil(alignedSize / this.workgroupSize);
      this.bufferAllocator.create(BUFFER_NAMES.WORKGROUP_XORS, {
        size: Math.max(4, maxWorkgroups * 4),
        usage:
          GPUBufferUsage.STORAGE |
          GPUBufferUsage.COPY_SRC |
          GPUBufferUsage.COPY_DST,
        label: "Workgroup XORs Buffer",
      });

      // Create bind groups
      this.pass1BindGroup = this.device.createBindGroup({
        label: "CSV Indexer Pass 1 Bind Group",
        layout: this.pass1BindGroupLayout!,
        entries: [
          {
            binding: 0,
            resource: { buffer: this.bufferAllocator.get(BUFFER_NAMES.INPUT) },
          },
          {
            binding: 1,
            resource: {
              buffer: this.bufferAllocator.get(BUFFER_NAMES.WORKGROUP_XORS),
            },
          },
          {
            binding: 2,
            resource: {
              buffer: this.bufferAllocator.get(BUFFER_NAMES.UNIFORMS),
            },
          },
        ],
      });

      this.pass2BindGroup = this.device.createBindGroup({
        label: "CSV Indexer Pass 2 Bind Group",
        layout: this.pass2BindGroupLayout!,
        entries: [
          {
            binding: 0,
            resource: { buffer: this.bufferAllocator.get(BUFFER_NAMES.INPUT) },
          },
          {
            binding: 1,
            resource: {
              buffer: this.bufferAllocator.get(BUFFER_NAMES.SEP_INDICES),
            },
          },
          {
            binding: 2,
            resource: {
              buffer: this.bufferAllocator.get(BUFFER_NAMES.ATOMIC_INDEX),
            },
          },
          {
            binding: 3,
            resource: {
              buffer: this.bufferAllocator.get(BUFFER_NAMES.UNIFORMS),
            },
          },
          {
            binding: 4,
            resource: {
              buffer: this.bufferAllocator.get(BUFFER_NAMES.RESULT_META),
            },
          },
          {
            binding: 5,
            resource: {
              buffer: this.bufferAllocator.get(BUFFER_NAMES.WORKGROUP_XORS),
            },
          },
        ],
      });

      this.currentBufferSize = alignedSize;
    } catch (error) {
      // GPU buffer allocation failed - propagate memory error for fallback handling
      if (error instanceof GPUMemoryError) {
        throw error;
      }
      // Unexpected error - wrap it as GPUMemoryError
      throw new GPUMemoryError(
        `Failed to allocate GPU buffers for CSV parsing (${alignedSize} bytes): ${error instanceof Error ? error.message : String(error)}`,
        {
          requestedSize: alignedSize,
          cause: error instanceof Error ? error : undefined,
        },
      );
    }
  }

  /**
   * Dispatch a compute operation
   *
   * Executes the two-pass GPU compute to find separators in CSV data.
   *
   * @throws {Error} If backend is not initialized
   * @throws {RangeError} If input size exceeds GPU device limits (getMaxChunkSize())
   */
  async dispatch(
    input: Uint8Array,
    uniforms: ParseUniforms,
  ): Promise<ComputeDispatchResult<GPUParseResult>> {
    if (!this.initialized || !this.device || !this.bufferAllocator) {
      throw new Error("CSVSeparatorIndexingBackend not initialized");
    }

    const timing: ComputeTiming = {
      totalMs: 0,
      phases: {
        pass1Gpu: 0,
        gpuToCpu: 0,
        cpuCompute: 0,
        cpuToGpu: 0,
        pass2Gpu: 0,
        resultRead: 0,
      },
    };

    const startTime = performance.now();

    // Handle empty chunks early - no GPU work or buffer allocation needed
    if (input.length === 0) {
      return {
        data: {
          sepIndices: new Uint32Array(0),
          endInQuote: uniforms.prevInQuote,
          sepCount: 0,
        },
        timing: this.config.enableTiming
          ? {
              totalMs: performance.now() - startTime,
              phases: {
                pass1Gpu: 0,
                gpuToCpu: 0,
                cpuCompute: 0,
                cpuToGpu: 0,
                pass2Gpu: 0,
                resultRead: 0,
              },
            }
          : undefined,
      };
    }

    // Validate chunk size before buffer allocation
    const maxChunkSize = this.getMaxChunkSize();
    if (input.length > maxChunkSize) {
      throw new RangeError(
        `Chunk size (${input.length} bytes) exceeds maximum supported size (${maxChunkSize} bytes). ` +
          `Maximum is determined by GPU limit: maxComputeWorkgroupsPerDimension (${this.device?.limits.maxComputeWorkgroupsPerDimension ?? 65535}) × workgroupSize (${this.workgroupSize}). ` +
          `Please split the input into smaller chunks using CSVSeparatorIndexer for streaming processing.`,
      );
    }

    // Pad input to u32 alignment
    const paddedInput = padToU32Aligned(input);
    const actualSize = input.length;
    const workgroupCount = Math.ceil(actualSize / this.workgroupSize);

    // Ensure buffers are large enough
    this.ensureBuffers(paddedInput.length);

    // Reset workgroup XORs buffer
    this.device.queue.writeBuffer(
      this.bufferAllocator.get(BUFFER_NAMES.WORKGROUP_XORS),
      0,
      new Uint32Array(workgroupCount).fill(0),
    );

    // Upload input data
    this.device.queue.writeBuffer(
      this.bufferAllocator.get(BUFFER_NAMES.INPUT),
      0,
      paddedInput as unknown as BufferSource,
    );

    // Upload Pass 1 uniforms
    const pass1UniformsData = new Uint32Array([
      actualSize,
      uniforms.prevInQuote,
      uniforms.quotation,
      uniforms.delimiter,
    ]);
    this.device.queue.writeBuffer(
      this.bufferAllocator.get(BUFFER_NAMES.UNIFORMS),
      0,
      pass1UniformsData,
    );

    // ========================================================================
    // Pass 1: Collect workgroup quote parities
    // ========================================================================

    const pass1Start = performance.now();

    const pass1Encoder = this.device.createCommandEncoder({
      label: "CSV Indexer Pass 1 Command Encoder",
    });

    const pass1 = pass1Encoder.beginComputePass({
      label: "CSV Indexer Pass 1 Compute Pass",
    });

    pass1.setPipeline(this.pass1Pipeline!);
    pass1.setBindGroup(0, this.pass1BindGroup!);
    pass1.dispatchWorkgroups(workgroupCount);
    pass1.end();

    // Create read buffer for workgroup parities
    const workgroupXORsReadBuffer = this.device.createBuffer({
      size: this.bufferAllocator.getSize(BUFFER_NAMES.WORKGROUP_XORS),
      usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ,
    });

    pass1Encoder.copyBufferToBuffer(
      this.bufferAllocator.get(BUFFER_NAMES.WORKGROUP_XORS),
      0,
      workgroupXORsReadBuffer,
      0,
      this.bufferAllocator.getSize(BUFFER_NAMES.WORKGROUP_XORS),
    );

    this.device.queue.submit([pass1Encoder.finish()]);

    timing.phases!.pass1Gpu = performance.now() - pass1Start;

    // Read workgroup parities
    const gpuToCpuStart = performance.now();
    await workgroupXORsReadBuffer.mapAsync(GPUMapMode.READ);
    const workgroupParities = new Uint32Array(
      workgroupXORsReadBuffer.getMappedRange().slice(0),
    );
    workgroupXORsReadBuffer.unmap();
    workgroupXORsReadBuffer.destroy();
    timing.phases!.gpuToCpu = performance.now() - gpuToCpuStart;

    // ========================================================================
    // CPU: Compute prefix XOR across workgroups
    // ========================================================================

    const cpuComputeStart = performance.now();
    const prefixXORs = new Uint32Array(workgroupCount);
    let prefix = uniforms.prevInQuote;
    for (let i = 0; i < workgroupCount; i++) {
      prefixXORs[i] = prefix;
      prefix ^= workgroupParities[i]!;
    }
    timing.phases!.cpuCompute = performance.now() - cpuComputeStart;

    // Upload prefix XORs for Pass 2
    const cpuToGpuStart = performance.now();
    this.device.queue.writeBuffer(
      this.bufferAllocator.get(BUFFER_NAMES.WORKGROUP_XORS),
      0,
      prefixXORs,
    );
    timing.phases!.cpuToGpu = performance.now() - cpuToGpuStart;

    // ========================================================================
    // Pass 2: Detect separators with CPU-computed quote states
    // ========================================================================

    const pass2Start = performance.now();

    // Reset atomic counter and result metadata
    this.device.queue.writeBuffer(
      this.bufferAllocator.get(BUFFER_NAMES.ATOMIC_INDEX),
      0,
      new Uint32Array([0]),
    );
    this.device.queue.writeBuffer(
      this.bufferAllocator.get(BUFFER_NAMES.RESULT_META),
      0,
      new Uint32Array([0, 0, 0, 0]),
    );

    // Upload Pass 2 uniforms
    const pass2UniformsData = new Uint32Array([
      actualSize,
      uniforms.prevInQuote,
      uniforms.quotation,
      uniforms.delimiter,
    ]);
    this.device.queue.writeBuffer(
      this.bufferAllocator.get(BUFFER_NAMES.UNIFORMS),
      0,
      pass2UniformsData,
    );

    const pass2Encoder = this.device.createCommandEncoder({
      label: "CSV Indexer Pass 2 Command Encoder",
    });

    const pass2 = pass2Encoder.beginComputePass({
      label: "CSV Indexer Pass 2 Compute Pass",
    });

    pass2.setPipeline(this.pass2Pipeline!);
    pass2.setBindGroup(0, this.pass2BindGroup!);
    pass2.dispatchWorkgroups(workgroupCount);
    pass2.end();

    // Create read buffers for results
    const sepIndicesReadBuffer = this.device.createBuffer({
      size: this.bufferAllocator.getSize(BUFFER_NAMES.SEP_INDICES),
      usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ,
    });

    const atomicIndexReadBuffer = this.device.createBuffer({
      size: 4,
      usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ,
    });

    const resultMetaReadBuffer = this.device.createBuffer({
      size: 16,
      usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ,
    });

    pass2Encoder.copyBufferToBuffer(
      this.bufferAllocator.get(BUFFER_NAMES.SEP_INDICES),
      0,
      sepIndicesReadBuffer,
      0,
      this.bufferAllocator.getSize(BUFFER_NAMES.SEP_INDICES),
    );

    pass2Encoder.copyBufferToBuffer(
      this.bufferAllocator.get(BUFFER_NAMES.ATOMIC_INDEX),
      0,
      atomicIndexReadBuffer,
      0,
      4,
    );

    pass2Encoder.copyBufferToBuffer(
      this.bufferAllocator.get(BUFFER_NAMES.RESULT_META),
      0,
      resultMetaReadBuffer,
      0,
      16,
    );

    this.device.queue.submit([pass2Encoder.finish()]);

    timing.phases!.pass2Gpu = performance.now() - pass2Start;

    // Read results
    const resultReadStart = performance.now();
    await Promise.all([
      sepIndicesReadBuffer.mapAsync(GPUMapMode.READ),
      atomicIndexReadBuffer.mapAsync(GPUMapMode.READ),
      resultMetaReadBuffer.mapAsync(GPUMapMode.READ),
    ]);

    const sepIndices = new Uint32Array(
      sepIndicesReadBuffer.getMappedRange().slice(0),
    );
    const atomicIndexData = new Uint32Array(
      atomicIndexReadBuffer.getMappedRange().slice(0),
    );
    const metaData = new Uint32Array(
      resultMetaReadBuffer.getMappedRange().slice(0),
    );

    sepIndicesReadBuffer.unmap();
    atomicIndexReadBuffer.unmap();
    resultMetaReadBuffer.unmap();

    sepIndicesReadBuffer.destroy();
    atomicIndexReadBuffer.destroy();
    resultMetaReadBuffer.destroy();

    timing.phases!.resultRead = performance.now() - resultReadStart;
    timing.totalMs = performance.now() - startTime;

    const actualSepCount = atomicIndexData[0]!;

    // Debug timing output
    if (
      (DEBUG_TIMING || this.config.enableTiming) &&
      actualSize >= 1024 * 1024
    ) {
      const timingData = {
        chunkSize: `${(actualSize / 1024).toFixed(1)} KB`,
        workgroups: workgroupCount,
        ...Object.fromEntries(
          Object.entries(timing.phases!).map(([k, v]) => [k, v.toFixed(3)]),
        ),
        total: timing.totalMs.toFixed(3),
      };
      console.log(
        "[CSVSeparatorIndexingBackend Timing]",
        JSON.stringify(timingData, null, 2),
      );

      if (typeof window !== "undefined") {
        (window as unknown as Record<string, unknown>).lastWebGPUTiming =
          timingData;
      }
    }

    return {
      data: {
        sepIndices,
        endInQuote: metaData[0]!,
        sepCount: actualSepCount,
      },
      timing: this.config.enableTiming ? timing : undefined,
    };
  }

  /**
   * Run separator detection on a single chunk of CSV data
   *
   * Processes the given chunk through GPU-accelerated separator detection.
   * Note: This method does not handle leftover bytes - that is managed by CSVSeparatorIndexer.
   *
   * @param chunk - Chunk of CSV data to process (must not exceed getMaxChunkSize())
   * @param prevInQuote - Quote state at the start of this chunk (false = outside quotes, true = inside quotes)
   * @returns Promise resolving to separator detection result with separators, counts, and ending quote state
   *
   * @throws {Error} If backend is not initialized (call initialize() first)
   * @throws {RangeError} If chunk size exceeds GPU device limits (getMaxChunkSize())
   * @throws {GPUMemoryError} If GPU buffer allocation fails
   *
   * @example
   * ```ts
   * const backend = new CSVSeparatorIndexingBackend({ gpu });
   * await backend.initialize();
   *
   * const encoder = new TextEncoder();
   * const csvBytes = encoder.encode("a,b,c\nd,e,f\n");
   *
   * // Process chunk starting outside quotes
   * const result = await backend.run(csvBytes, false);
   * console.log(result.sepCount); // Number of separators found
   * console.log(result.endInQuote); // Quote state at chunk end
   *
   * await backend.destroy();
   * ```
   */
  async run(
    chunk: Uint8Array,
    prevInQuote: boolean,
  ): Promise<CSVSeparatorIndexResult> {
    const result = await this.dispatch(chunk, {
      chunkSize: chunk.length,
      prevInQuote: prevInQuote ? 1 : 0,
      quotation: this.config.quotation.charCodeAt(0),
      delimiter: this.config.delimiter.charCodeAt(0),
    });

    const processedBytes = getProcessedBytesCount(
      result.data.sepIndices,
      result.data.sepCount,
    );

    return {
      separators: sortSeparatorsByOffset(
        result.data.sepIndices,
        result.data.sepCount,
      ),
      sepCount: result.data.sepCount,
      processedBytes,
      endInQuote: Boolean(result.data.endInQuote),
    };
  }

  /**
   * Destroy the backend and release GPU resources
   */
  async destroy(): Promise<void> {
    if (this.bufferAllocator) {
      this.bufferAllocator.destroyAll();
      this.bufferAllocator = null;
    }

    // Shader modules are automatically garbage collected
    this.pass1ShaderModule = null;
    this.pass2ShaderModule = null;

    this.pass1Pipeline = null;
    this.pass2Pipeline = null;
    this.pass1BindGroupLayout = null;
    this.pass2BindGroupLayout = null;
    this.pass1BindGroup = null;
    this.pass2BindGroup = null;

    if (this.device && this.ownDevice) {
      this.device.destroy();
    }

    this.device = null;
    this.initialized = false;
    this.currentBufferSize = 0;
  }

  /**
   * AsyncDisposable implementation for automatic resource cleanup
   *
   * Enables usage with `await using` syntax for automatic lifecycle management.
   *
   * @example
   * ```ts
   * await using backend = new CSVSeparatorIndexingBackend();
   * await backend.initialize();
   * const result = await backend.run(data, false);
   * // backend is automatically destroyed when scope exits
   * ```
   */
  async [Symbol.asyncDispose](): Promise<void> {
    await this.destroy();
  }
}
