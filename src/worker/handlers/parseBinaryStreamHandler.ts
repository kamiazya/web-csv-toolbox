import type {
  CommandHandler,
  HandlerContext,
} from "@/worker/handlers/types.ts";
import type { ParseUint8ArrayStreamRequest } from "@/worker/helpers/worker.shared.ts";
import { buildTextStream } from "@/worker/utils/binaryDecodingUtils.ts";
import { streamRecords } from "@/worker/utils/outputStrategy.ts";
import {
  buildCSVStreamPipeline,
  streamToAsyncIterator,
} from "@/worker/utils/streamPipelineFactory.ts";

/**
 * Error thrown when GPU initialization fails and CPU fallback is needed.
 * @internal
 */
class GPUFallbackNeededError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GPUFallbackNeededError";
  }
}

/**
 * Handler for parseBinaryStream requests.
 * Supports both message-based and TransferableStream strategies.
 * @internal
 */
export const parseBinaryStreamHandler: CommandHandler<
  ParseUint8ArrayStreamRequest
> = async (request, context) => {
  // Support both 'stream' and 'data' properties for compatibility
  const stream = request.stream || request.data;

  if (!(stream instanceof ReadableStream)) {
    throw new Error(
      "parseBinaryStream requires 'stream' or 'data' property as ReadableStream. " +
        `Available properties: ${Object.keys(request).join(", ")}`,
    );
  }

  const { useGPU, options } = request;

  // GPU parsing path with CPU fallback
  // Note: GPU lexer assumes UTF-8 encoding, fall back to CPU for non-UTF-8
  const charset = options?.charset ?? "utf-8";
  const isUtf8 =
    charset.toLowerCase() === "utf-8" || charset.toLowerCase() === "utf8";

  if (useGPU && isUtf8) {
    try {
      await handleGPUParsing(stream, options, context);
      return;
    } catch (error) {
      // If GPU fallback is needed (WebGPU unavailable, etc.), continue to CPU path
      if (error instanceof GPUFallbackNeededError) {
        // Fall through to CPU path below
      } else {
        // Re-throw other errors (parsing errors, etc.)
        throw error;
      }
    }
  }

  // Regular CPU parsing path (also used as fallback when GPU fails)
  await handleCPUParsing(stream, options, context);
};

/**
 * Handle CPU-based binary stream parsing.
 * @internal
 */
async function handleCPUParsing(
  stream: ReadableStream<Uint8Array>,
  options: ParseUint8ArrayStreamRequest["options"],
  context: HandlerContext,
): Promise<void> {
  const textStream = buildTextStream(stream, options);
  const resultStream = await buildCSVStreamPipeline(textStream, options);
  const iterator = await streamToAsyncIterator(resultStream);

  await streamRecords(context.outputStrategy, iterator);
}

/**
 * Handle GPU-accelerated binary stream parsing.
 *
 * Note: GPU lexer assumes UTF-8 encoding. Caller should ensure charset is UTF-8
 * before calling this function.
 *
 * @throws {GPUFallbackNeededError} When WebGPU is unavailable or initialization fails
 * @internal
 */
async function handleGPUParsing(
  stream: ReadableStream<Uint8Array>,
  options: ParseUint8ArrayStreamRequest["options"],
  context: HandlerContext,
): Promise<void> {
  const gpuOptions = (options as { engine?: { gpuOptions?: unknown } })?.engine
    ?.gpuOptions;

  const { WorkerGPUDeviceResolver } = await import(
    "@/worker/gpu/WorkerGPUDeviceResolver.ts"
  );
  const { CSVSeparatorIndexingBackend } = await import(
    "@/parser/webgpu/indexing/CSVSeparatorIndexingBackend.ts"
  );
  const { GPUBinaryCSVLexer } = await import(
    "@/parser/webgpu/lexer/GPUBinaryCSVLexer.ts"
  );
  const { createCSVRecordAssembler } = await import(
    "@/parser/api/model/createCSVRecordAssembler.ts"
  );

  // Try to initialize GPU resources - if this fails, we can still fall back to CPU
  // because we haven't consumed the stream yet
  const resolver = new WorkerGPUDeviceResolver(
    gpuOptions as import("@/core/types.ts").SerializableGPUOptions,
  );

  let device: GPUDevice;
  let backend: InstanceType<typeof CSVSeparatorIndexingBackend>;

  try {
    device = await resolver.getDevice();
  } catch (error) {
    resolver.dispose();
    throw new GPUFallbackNeededError(
      `WebGPU device unavailable: ${error instanceof Error ? error.message : String(error)}`,
    );
  }

  try {
    backend = new CSVSeparatorIndexingBackend({ device });
    await backend.initialize();
  } catch (error) {
    resolver.dispose();
    throw new GPUFallbackNeededError(
      `GPU backend initialization failed: ${error instanceof Error ? error.message : String(error)}`,
    );
  }

  // GPU is ready - now we can start consuming the stream
  // Apply decompression if specified (GPU lexer works with decompressed binary data)
  let inputStream = stream;
  if (options?.decompression) {
    inputStream = stream.pipeThrough(
      new DecompressionStream(
        options.decompression,
      ) as unknown as TransformStream<Uint8Array, Uint8Array>,
    );
  }

  try {
    const lexer = new GPUBinaryCSVLexer({
      backend,
      delimiter: options?.delimiter ?? ",",
    });
    // Use createCSVRecordAssembler to respect all options (outputFormat, headerless, etc.)
    const assembler = createCSVRecordAssembler(options);

    const reader = inputStream.getReader();
    try {
      // Process stream chunks
      while (true) {
        const { value: chunk, done } = await reader.read();
        if (done) break;

        for await (const token of lexer.lex(chunk, { stream: true })) {
          for (const record of assembler.assemble(token, { stream: true })) {
            context.outputStrategy.sendRecord(record);
          }
        }
      }

      // Flush lexer
      for await (const token of lexer.lex()) {
        for (const record of assembler.assemble(token, { stream: true })) {
          context.outputStrategy.sendRecord(record);
        }
      }

      // Flush assembler
      for (const record of assembler.assemble()) {
        context.outputStrategy.sendRecord(record);
      }

      context.outputStrategy.sendDone();
    } finally {
      reader.releaseLock();
    }
  } finally {
    await backend.destroy();
    resolver.dispose();
  }
}
