/**
 * WebGPU Backend for CSV Indexing
 *
 * Handles GPU device initialization, shader compilation, buffer management,
 * and compute pass execution for parallel CSV separator detection.
 */

// Import shader source (will be bundled as string)
import shaderSource from "../shaders/csv-indexer.wgsl?raw";
import { alignToU32, padToU32Aligned } from "../utils/buffer-utils.ts";
import type {
  GPUBuffers,
  GPUParseResult,
  ParseUniforms,
  WebGPUParserConfig,
} from "./types.ts";

const DEFAULT_CHUNK_SIZE = 1024 * 1024; // 1MB
const WORKGROUP_SIZE = 256;

/**
 * WebGPU backend for parallel CSV indexing
 *
 * This class manages the GPU resources and executes the compute shader
 * to identify separator positions in CSV data.
 */
export class GPUBackend {
  private device: GPUDevice | null = null;
  private pipeline: GPUComputePipeline | null = null;
  private bindGroupLayout: GPUBindGroupLayout | null = null;
  private readonly config: Required<WebGPUParserConfig>;
  private buffers: GPUBuffers | null = null;
  private readonly ownDevice: boolean;

  constructor(config: WebGPUParserConfig = {}) {
    const chunkSize = config.chunkSize || DEFAULT_CHUNK_SIZE;
    this.config = {
      chunkSize: alignToU32(chunkSize),
      maxSeparators: config.maxSeparators || Math.floor(chunkSize / 2),
      device: config.device,
    };
    this.ownDevice = !config.device;
  }

  /**
   * Initializes the GPU device and compiles the compute shader
   */
  async initialize(): Promise<void> {
    if (this.device) {
      return; // Already initialized
    }

    // Get or create GPU device
    if (this.config.device) {
      this.device = this.config.device;
    } else {
      if (!navigator.gpu) {
        throw new Error("WebGPU is not supported in this browser");
      }

      const adapter = await navigator.gpu.requestAdapter();
      if (!adapter) {
        throw new Error("Failed to get GPU adapter");
      }

      this.device = await adapter.requestDevice();
    }

    // Create bind group layout
    this.bindGroupLayout = this.device.createBindGroupLayout({
      label: "CSV Indexer Bind Group Layout",
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
      ],
    });

    // Create pipeline layout
    const pipelineLayout = this.device.createPipelineLayout({
      label: "CSV Indexer Pipeline Layout",
      bindGroupLayouts: [this.bindGroupLayout],
    });

    // Compile shader module
    const shaderModule = this.device.createShaderModule({
      label: "CSV Indexer Shader",
      code: shaderSource,
    });

    // Create compute pipeline
    this.pipeline = this.device.createComputePipeline({
      label: "CSV Indexer Pipeline",
      layout: pipelineLayout,
      compute: {
        module: shaderModule,
        entryPoint: "main",
      },
    });
  }

  /**
   * Creates or resizes GPU buffers for a given chunk size
   */
  private createBuffers(chunkSize: number): GPUBuffers {
    if (!this.device) {
      throw new Error("GPU backend not initialized");
    }

    const alignedSize = alignToU32(chunkSize);

    // Create input buffer (u32-aligned for byte data)
    const inputBuffer = this.device.createBuffer({
      label: "Input Buffer",
      size: alignedSize,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
    });

    // Create separator indices buffer
    const sepIndicesBuffer = this.device.createBuffer({
      label: "Separator Indices Buffer",
      size: this.config.maxSeparators * 4, // u32 array
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC,
    });

    // Create atomic counter buffer
    const atomicIndexBuffer = this.device.createBuffer({
      label: "Atomic Index Buffer",
      size: 4, // Single u32
      usage:
        GPUBufferUsage.STORAGE |
        GPUBufferUsage.COPY_SRC |
        GPUBufferUsage.COPY_DST,
    });

    // Create uniforms buffer
    const uniformsBuffer = this.device.createBuffer({
      label: "Uniforms Buffer",
      size: 16, // 4 x u32 (with padding)
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });

    // Create result metadata buffer
    const resultMetaBuffer = this.device.createBuffer({
      label: "Result Meta Buffer",
      size: 16, // 4 x u32 (with padding)
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC,
    });

    // Create bind group
    const bindGroup = this.device.createBindGroup({
      label: "CSV Indexer Bind Group",
      layout: this.bindGroupLayout!,
      entries: [
        { binding: 0, resource: { buffer: inputBuffer } },
        { binding: 1, resource: { buffer: sepIndicesBuffer } },
        { binding: 2, resource: { buffer: atomicIndexBuffer } },
        { binding: 3, resource: { buffer: uniformsBuffer } },
        { binding: 4, resource: { buffer: resultMetaBuffer } },
      ],
    });

    return {
      inputBuffer,
      sepIndicesBuffer,
      atomicIndexBuffer,
      uniformsBuffer,
      resultMetaBuffer,
      bindGroup,
    };
  }

  /**
   * Executes the GPU compute pass to find separators in CSV data
   *
   * @param inputBytes - CSV data as byte array
   * @param uniforms - Parsing configuration (chunk size, previous quote state)
   * @returns Parse result with separator indices and metadata
   */
  async dispatch(
    inputBytes: Uint8Array,
    uniforms: ParseUniforms,
  ): Promise<GPUParseResult> {
    if (!this.device || !this.pipeline) {
      throw new Error("GPU backend not initialized");
    }

    // Pad input to u32 alignment
    const paddedInput = padToU32Aligned(inputBytes);
    const actualSize = inputBytes.length;

    // Create or reuse buffers
    if (!this.buffers || this.buffers.inputBuffer.size < paddedInput.length) {
      if (this.buffers) {
        this.destroyBuffers(this.buffers);
      }
      this.buffers = this.createBuffers(paddedInput.length);
    }

    // Reset atomic counter
    this.device.queue.writeBuffer(
      this.buffers.atomicIndexBuffer,
      0,
      new Uint32Array([0]),
    );

    // Reset result metadata buffer
    this.device.queue.writeBuffer(
      this.buffers.resultMetaBuffer,
      0,
      new Uint32Array([0, 0, 0, 0]),
    );

    // Upload input data
    this.device.queue.writeBuffer(this.buffers.inputBuffer, 0, paddedInput);

    // Upload uniforms
    const uniformsData = new Uint32Array([
      actualSize,
      uniforms.prevInQuote,
      0,
      0, // Padding
    ]);
    this.device.queue.writeBuffer(this.buffers.uniformsBuffer, 0, uniformsData);

    // Create command encoder
    const encoder = this.device.createCommandEncoder({
      label: "CSV Indexer Command Encoder",
    });

    // Compute pass
    const pass = encoder.beginComputePass({
      label: "CSV Indexer Compute Pass",
    });

    pass.setPipeline(this.pipeline);
    pass.setBindGroup(0, this.buffers.bindGroup);

    const workgroupCount = Math.ceil(actualSize / WORKGROUP_SIZE);
    pass.dispatchWorkgroups(workgroupCount);
    pass.end();

    // Read back results
    const sepIndicesReadBuffer = this.device.createBuffer({
      size: this.buffers.sepIndicesBuffer.size,
      usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ,
    });

    const resultMetaReadBuffer = this.device.createBuffer({
      size: 16,
      usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ,
    });

    encoder.copyBufferToBuffer(
      this.buffers.sepIndicesBuffer,
      0,
      sepIndicesReadBuffer,
      0,
      this.buffers.sepIndicesBuffer.size,
    );

    encoder.copyBufferToBuffer(
      this.buffers.resultMetaBuffer,
      0,
      resultMetaReadBuffer,
      0,
      16,
    );

    // Submit commands
    this.device.queue.submit([encoder.finish()]);

    // Read results
    await Promise.all([
      sepIndicesReadBuffer.mapAsync(GPUMapMode.READ),
      resultMetaReadBuffer.mapAsync(GPUMapMode.READ),
    ]);

    const sepIndices = new Uint32Array(
      sepIndicesReadBuffer.getMappedRange().slice(0),
    );
    const metaData = new Uint32Array(
      resultMetaReadBuffer.getMappedRange().slice(0),
    );

    sepIndicesReadBuffer.unmap();
    resultMetaReadBuffer.unmap();

    // Cleanup read buffers
    sepIndicesReadBuffer.destroy();
    resultMetaReadBuffer.destroy();

    return {
      sepIndices,
      endInQuote: metaData[0],
      sepCount: metaData[1],
    };
  }

  /**
   * Destroys GPU buffers to free resources
   */
  private destroyBuffers(buffers: GPUBuffers): void {
    buffers.inputBuffer.destroy();
    buffers.sepIndicesBuffer.destroy();
    buffers.atomicIndexBuffer.destroy();
    buffers.uniformsBuffer.destroy();
    buffers.resultMetaBuffer.destroy();
  }

  /**
   * Cleans up all GPU resources
   */
  async destroy(): Promise<void> {
    if (this.buffers) {
      this.destroyBuffers(this.buffers);
      this.buffers = null;
    }

    this.pipeline = null;
    this.bindGroupLayout = null;

    if (this.device && this.ownDevice) {
      this.device.destroy();
    }

    this.device = null;
  }
}
