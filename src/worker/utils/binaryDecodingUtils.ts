/**
 * Options for binary decoding.
 * @internal
 */
export interface BinaryDecodingOptions {
  charset?: string;
  fatal?: boolean;
  ignoreBOM?: boolean;
  decompression?: CompressionFormat;
}

/**
 * Build text decoder options from binary decoding options.
 * @internal
 */
export function buildTextDecoderOptions(
  options?: BinaryDecodingOptions,
): TextDecoderOptions {
  const decoderOptions: TextDecoderOptions = {};
  if (options?.fatal !== undefined) {
    decoderOptions.fatal = options.fatal;
  }
  if (options?.ignoreBOM !== undefined) {
    decoderOptions.ignoreBOM = options.ignoreBOM;
  }
  return decoderOptions;
}

/**
 * Build a text stream from a binary stream with optional decompression.
 *
 * This consolidates the repeated pattern of creating TextDecoderStream
 * with optional DecompressionStream.
 *
 * @internal
 */
export function buildTextStream(
  binaryStream: ReadableStream<Uint8Array>,
  options?: BinaryDecodingOptions,
): ReadableStream<string> {
  const charset = options?.charset ?? "utf-8";
  const decoderOptions = buildTextDecoderOptions(options);
  const textDecoderStream = new TextDecoderStream(
    charset,
    decoderOptions,
  ) as unknown as TransformStream<Uint8Array, string>;

  if (options?.decompression) {
    const decompressionStream = new DecompressionStream(
      options.decompression,
    ) as unknown as TransformStream<Uint8Array, Uint8Array>;
    return binaryStream
      .pipeThrough(decompressionStream)
      .pipeThrough(textDecoderStream);
  }

  return binaryStream.pipeThrough(textDecoderStream);
}

/**
 * Convert BufferSource to Uint8Array.
 * @internal
 */
export function toUint8Array(data: BufferSource): Uint8Array {
  if (data instanceof Uint8Array) {
    return data;
  }
  if (data instanceof ArrayBuffer) {
    return new Uint8Array(data);
  }
  // ArrayBufferView
  return new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
}

/**
 * Decode binary data to string with optional decompression.
 *
 * For non-streaming binary data (used with WASM parser).
 *
 * @internal
 */
export async function decodeBinaryToString(
  data: BufferSource,
  options?: BinaryDecodingOptions,
): Promise<string> {
  const charset = options?.charset ?? "utf-8";
  const decoderOptions = buildTextDecoderOptions(options);
  const bytes = toUint8Array(data);

  if (options?.decompression) {
    if (typeof DecompressionStream === "undefined") {
      throw new Error(
        "DecompressionStream is not available in this worker context. " +
          "Decompress the data on the main thread before passing to worker.",
      );
    }

    const decompressed = await new Response(
      new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(bytes);
          controller.close();
        },
      }).pipeThrough(
        new DecompressionStream(
          options.decompression,
        ) as unknown as TransformStream<Uint8Array, Uint8Array>,
      ),
    ).arrayBuffer();

    return new TextDecoder(charset, decoderOptions).decode(decompressed);
  }

  return new TextDecoder(charset, decoderOptions).decode(bytes);
}
