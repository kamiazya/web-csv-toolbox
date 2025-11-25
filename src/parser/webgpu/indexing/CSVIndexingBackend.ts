/**
 * CSV Indexing Backend
 *
 * WebGPU-based CSV separator detection using a two-pass algorithm.
 * Implements the GPUComputeBackend interface for consistent GPU compute operations.
 */

import pass1ShaderSource from "@/parser/webgpu/indexing/shaders/csv-indexer-pass1.wgsl?raw";
import pass2ShaderSource from "@/parser/webgpu/indexing/shaders/csv-indexer-pass2.wgsl?raw";
import type {
  GPUParseResult,
  ParseUniforms,
} from "@/parser/webgpu/indexing/types.ts";
import { GPUBufferAllocator } from "@/webgpu/compute/GPUBufferAllocator.ts";
import type {
  ComputeDispatchResult,
  ComputeTiming,
  GPUComputeBackend,
} from "@/webgpu/compute/GPUComputeBackend.ts";
import { GPUShaderLoader } from "@/webgpu/compute/GPUShaderLoader.ts";
import { alignToU32 } from "@/webgpu/utils/alignToU32.ts";
import { padToU32Aligned } from "@/webgpu/utils/padToU32Aligned.ts";

/**
 * Default chunk size for CSV processing (1MB)
 */
const DEFAULT_CHUNK_SIZE = 1024 * 1024;

/**
 * Workgroup size for GPU compute (matches shader)
 */
const WORKGROUP_SIZE = 256;

/**
 * Enable debug timing logs for benchmarking
 * Set to true only during development/benchmarking
 */
const DEBUG_TIMING = false;

/**
 * Configuration for CSV Indexing Backend
 */
export interface CSVIndexingBackendConfig {
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
 * Shader names for the CSV indexing backend
 */
const SHADER_NAMES = {
  PASS1: "csvIndexerPass1",
  PASS2: "csvIndexerPass2",
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
 *
 * @example
 * ```ts
 * const backend = new CSVIndexingBackend({ chunkSize: 1024 * 1024 });
 * await backend.initialize();
 *
 * const result = await backend.dispatch(csvBytes, { chunkSize: csvBytes.length, prevInQuote: 0 });
 * console.log(`Found ${result.data.sepCount} separators`);
 *
 * await backend.destroy();
 * ```
 */
export class CSVIndexingBackend
  implements GPUComputeBackend<Uint8Array, ParseUniforms, GPUParseResult>
{
  private device: GPUDevice | null = null;
  private bufferAllocator: GPUBufferAllocator | null = null;
  private shaderLoader: GPUShaderLoader | null = null;

  private pass1Pipeline: GPUComputePipeline | null = null;
  private pass2Pipeline: GPUComputePipeline | null = null;
  private pass1BindGroupLayout: GPUBindGroupLayout | null = null;
  private pass2BindGroupLayout: GPUBindGroupLayout | null = null;
  private pass1BindGroup: GPUBindGroup | null = null;
  private pass2BindGroup: GPUBindGroup | null = null;

  private readonly config: Required<
    Omit<CSVIndexingBackendConfig, "gpu" | "device">
  > & {
    gpu?: GPU;
    device?: GPUDevice;
  };
  private readonly ownDevice: boolean;
  private initialized = false;
  private currentBufferSize = 0;

  constructor(config: CSVIndexingBackendConfig = {}) {
    const chunkSize = config.chunkSize || DEFAULT_CHUNK_SIZE;
    this.config = {
      chunkSize: alignToU32(chunkSize),
      maxSeparators: config.maxSeparators ?? chunkSize,
      gpu: config.gpu,
      device: config.device,
      enableTiming: config.enableTiming ?? false,
    };
    this.ownDevice = !config.device;
  }

  /**
   * Check if backend is initialized and ready
   */
  get isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * Get the underlying GPU device
   */
  getDevice(): GPUDevice | null {
    return this.device;
  }

  /**
   * Get the maximum safe chunk size for a single GPU dispatch
   *
   * Calculated from GPU device limits:
   * - maxComputeWorkgroupsPerDimension (default: 65535)
   * - WORKGROUP_SIZE (256 bytes per workgroup)
   *
   * @returns Maximum chunk size in bytes, or default if device not initialized
   */
  getMaxChunkSize(): number {
    if (!this.device) {
      // Fallback to conservative default (65535 * 256)
      return 65535 * WORKGROUP_SIZE;
    }
    const maxWorkgroups = this.device.limits.maxComputeWorkgroupsPerDimension;
    return maxWorkgroups * WORKGROUP_SIZE;
  }

  /**
   * Initialize the backend
   *
   * Sets up GPU device, compiles shaders, creates pipelines.
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    // Get or create GPU device
    if (this.config.device) {
      this.device = this.config.device;
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

      this.device = await adapter.requestDevice();
    }

    // Initialize buffer allocator and shader loader
    this.bufferAllocator = new GPUBufferAllocator(this.device);
    this.shaderLoader = new GPUShaderLoader(this.device);

    // Compile shaders
    this.shaderLoader.compile(SHADER_NAMES.PASS1, {
      code: pass1ShaderSource,
      label: "CSV Indexer Pass 1 Shader",
    });
    this.shaderLoader.compile(SHADER_NAMES.PASS2, {
      code: pass2ShaderSource,
      label: "CSV Indexer Pass 2 Shader",
    });

    // Create bind group layouts and pipelines
    this.createPipelines();

    this.initialized = true;
  }

  /**
   * Create compute pipelines for both passes
   */
  private createPipelines(): void {
    if (!this.device || !this.shaderLoader) {
      throw new Error("Device or shader loader not initialized");
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
        module: this.shaderLoader.getModule(SHADER_NAMES.PASS1),
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
        module: this.shaderLoader.getModule(SHADER_NAMES.PASS2),
        entryPoint: "main",
      },
    });
  }

  /**
   * Create or resize buffers for processing
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
    const maxWorkgroups = Math.ceil(alignedSize / WORKGROUP_SIZE);
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
          resource: { buffer: this.bufferAllocator.get(BUFFER_NAMES.UNIFORMS) },
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
          resource: { buffer: this.bufferAllocator.get(BUFFER_NAMES.UNIFORMS) },
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
  }

  /**
   * Dispatch a compute operation
   *
   * Executes the two-pass GPU compute to find separators in CSV data.
   */
  async dispatch(
    input: Uint8Array,
    uniforms: ParseUniforms,
  ): Promise<ComputeDispatchResult<GPUParseResult>> {
    if (!this.initialized || !this.device || !this.bufferAllocator) {
      throw new Error("CSVIndexingBackend not initialized");
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

    // Pad input to u32 alignment
    const paddedInput = padToU32Aligned(input);
    const actualSize = input.length;
    const workgroupCount = Math.ceil(actualSize / WORKGROUP_SIZE);

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
      0,
      0,
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
      workgroupCount,
      0,
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
        "[CSVIndexingBackend Timing]",
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
   * Destroy the backend and release GPU resources
   */
  async destroy(): Promise<void> {
    if (this.bufferAllocator) {
      this.bufferAllocator.destroyAll();
      this.bufferAllocator = null;
    }

    if (this.shaderLoader) {
      this.shaderLoader.destroyAll();
      this.shaderLoader = null;
    }

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
}
