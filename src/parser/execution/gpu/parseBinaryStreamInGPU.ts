/**
 * WebGPU execution for parseBinaryStream (New Implementation)
 *
 * This module provides GPU-accelerated binary stream CSV parsing using WebGPU.
 * It uses the standard Lexer/Assembler pipeline with GPUBinaryCSVLexer.
 *
 * Large chunks are automatically split to stay within GPU dispatch limits.
 */

import type {
  CSVRecord,
  ParseBinaryOptions,
  ParseOptions,
} from "@/core/types.ts";
import { CSVSeparatorIndexingBackend } from "@/parser/webgpu/indexing/CSVSeparatorIndexingBackend.ts";
import {
  GPUBinaryCSVLexer,
  type GPUBinaryCSVLexerConfig,
} from "@/parser/webgpu/lexer/GPUBinaryCSVLexer.ts";
import { FlexibleCSVObjectRecordAssembler } from "@/parser/models/FlexibleCSVObjectRecordAssembler.ts";
import { FlexibleCSVArrayRecordAssembler } from "@/parser/models/FlexibleCSVArrayRecordAssembler.ts";

/**
 * Parse CSV binary stream using WebGPU
 *
 * @param stream - ReadableStream of CSV bytes (Uint8Array)
 * @param options - Parse options
 * @yields Parsed CSV records as they are parsed (true streaming)
 *
 * @remarks
 * Large chunks are automatically split within the backend to stay within
 * GPU dispatch limits (maxComputeWorkgroupsPerDimension * 256 bytes).
 */
export async function* parseBinaryStreamInGPU<
  Header extends ReadonlyArray<string>,
  Delimiter extends string = ",",
  Quotation extends string = '"',
>(
  stream: ReadableStream<Uint8Array>,
  options?:
    | ParseOptions<Header, Delimiter, Quotation>
    | ParseBinaryOptions<Header, Delimiter, Quotation>,
): AsyncIterableIterator<CSVRecord<Header>> {
  // Get device from gpuDeviceManager if provided
  const gpuDeviceManager = options?.engine?.gpuDeviceManager;
  let device: GPUDevice | undefined;

  // Determine header settings
  const header: ReadonlyArray<string> | undefined = options?.header;
  const isHeaderlessMode =
    options?.header !== undefined &&
    Array.isArray(options.header) &&
    options.header.length === 0;
  const outputFormat = options?.outputFormat ?? "object";

  // Initialize backend
  let backend: CSVSeparatorIndexingBackend | undefined;

  try {
    // Get GPU device
    if (gpuDeviceManager) {
      device = await gpuDeviceManager.getDevice();
    }

    // Create backend with device if available
    backend = new CSVSeparatorIndexingBackend(device ? { device } : undefined);
    await backend.initialize();

    // Create lexer
    const lexerConfig: GPUBinaryCSVLexerConfig = {
      backend,
      delimiter: options?.delimiter ?? ",",
    };
    const lexer = new GPUBinaryCSVLexer(lexerConfig);

    // Create assembler based on output format and header settings
    // The assembler handles auto-header detection internally when header is undefined
    type AssemblerType =
      | FlexibleCSVObjectRecordAssembler<Header>
      | FlexibleCSVArrayRecordAssembler<Header>;

    // Determine header to pass to assembler
    // - For headerless mode (header: []), pass empty array
    // - For explicit header, pass it through
    // - For auto-header (header: undefined), pass undefined so assembler auto-detects
    const assemblerHeader = isHeaderlessMode
      ? ([] as unknown as Header)
      : (header as Header | undefined);

    const assembler: AssemblerType =
      outputFormat === "array"
        ? new FlexibleCSVArrayRecordAssembler<Header>({ header: assemblerHeader })
        : new FlexibleCSVObjectRecordAssembler<Header>({ header: assemblerHeader });

    // Process stream
    const reader = stream.getReader();

    try {
      while (true) {
        const { value: chunk, done } = await reader.read();
        if (done) break;

        // Lex chunk to tokens
        for await (const token of lexer.lex(chunk, { stream: true })) {
          // Assemble tokens to records
          for (const record of assembler.assemble(token, { stream: true })) {
            yield record as CSVRecord<Header>;
          }
        }
      }

      // Flush lexer
      for await (const token of lexer.lex()) {
        for (const record of assembler.assemble(token, { stream: true })) {
          yield record as CSVRecord<Header>;
        }
      }

      // Flush assembler
      for (const record of assembler.assemble()) {
        yield record as CSVRecord<Header>;
      }
    } finally {
      reader.releaseLock();
    }
  } finally {
    // Cleanup
    if (backend) {
      await backend.destroy();
    }

    // Release device back to manager
    if (gpuDeviceManager) {
      gpuDeviceManager.releaseDevice();
    }
  }
}
