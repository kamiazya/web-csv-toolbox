import type {
  CSVRecord,
  ParseBinaryOptions,
  ParseOptions,
} from "../common/types.ts";

/**
 * Route Uint8Array stream parsing to appropriate execution environment using dynamic imports.
 *
 * @internal
 * @param stream CSV Uint8Array stream to parse
 * @param options Parsing options (including execution strategies)
 * @returns Async iterable iterator of records
 *
 * @remarks
 * WASM does not support streaming yet.
 * Throws an error if WASM is specified in execution array.
 */
export async function routeUint8ArrayStreamParsing<
  Header extends ReadonlyArray<string>,
>(
  stream: ReadableStream<Uint8Array>,
  options?: ParseBinaryOptions<Header>,
): Promise<AsyncIterableIterator<CSVRecord<Header>>> {
  const execution = options?.execution ?? [];
  const useWorker = execution.includes("worker");
  const useWASM = execution.includes("wasm");

  // WASM doesn't support streaming yet
  if (useWASM) {
    throw new Error(
      "WASM execution does not support streaming. " +
        'Consider collecting to binary first or use execution: ["worker"] instead.',
    );
  }

  // Worker with binary streaming
  if (useWorker) {
    const { parseUint8ArrayStreamInWorker } = await import(
      "./worker/parseUint8ArrayStreamInWorker.ts"
    );
    return parseUint8ArrayStreamInWorker(stream, options);
  }

  // Default: main thread streaming
  const { parseUint8ArrayStreamInMain } = await import(
    "./main/parseUint8ArrayStreamInMain.ts"
  );
  return parseUint8ArrayStreamInMain(stream, options);
}

/**
 * Route string parsing to appropriate execution environment using dynamic imports.
 *
 * @internal
 * @param csv CSV string to parse
 * @param options Parsing options (including execution strategies)
 * @returns Async iterable iterator of records
 *
 * @remarks
 * Uses dynamic imports to load only the necessary execution implementations,
 * reducing bundle size and enabling code splitting.
 *
 * Execution strategy combinations:
 * - `[]` or undefined: Main thread with default implementation
 * - `['worker']`: Worker thread with default implementation
 * - `['wasm']`: Main thread with WASM implementation
 * - `['worker', 'wasm']`: Worker thread with WASM implementation
 */
export async function routeStringParsing<Header extends ReadonlyArray<string>>(
  csv: string,
  options?: ParseOptions<Header>,
): Promise<AsyncIterableIterator<CSVRecord<Header>>> {
  const execution = options?.execution ?? [];
  const useWorker = execution.includes("worker");
  const useWASM = execution.includes("wasm");

  // Case 1: Worker + WASM
  if (useWorker && useWASM) {
    const { parseStringInWorkerWASM } = await import(
      "./worker/parseStringInWorker.ts"
    );
    return parseStringInWorkerWASM(csv, options);
  }

  // Case 2: Worker only
  if (useWorker) {
    const { parseStringInWorker } = await import(
      "./worker/parseStringInWorker.ts"
    );
    return parseStringInWorker(csv, options);
  }

  // Case 3: WASM only (main thread)
  if (useWASM) {
    const { parseStringInWASM } = await import("./wasm/parseStringInWASM.ts");
    return parseStringInWASM(csv, options);
  }

  // Case 4: Default (main thread, no WASM)
  const { parseStringInMain } = await import("./main/parseStringInMain.ts");
  return parseStringInMain(csv, options);
}

/**
 * Route stream parsing to appropriate execution environment using dynamic imports.
 *
 * @internal
 * @param stream CSV string stream to parse
 * @param options Parsing options (including execution strategies)
 * @returns Async iterable iterator of records
 *
 * @remarks
 * WASM does not support streaming yet.
 * Throws an error if WASM is specified in execution array.
 */
export async function routeStreamParsing<Header extends ReadonlyArray<string>>(
  stream: ReadableStream<string>,
  options?: ParseOptions<Header>,
): Promise<AsyncIterableIterator<CSVRecord<Header>>> {
  const execution = options?.execution ?? [];
  const useWorker = execution.includes("worker");
  const useWASM = execution.includes("wasm");

  // WASM doesn't support streaming yet
  if (useWASM) {
    throw new Error(
      "WASM execution does not support streaming. " +
        'Consider collecting to string first or use execution: ["worker"] instead.',
    );
  }

  // Worker with streaming
  if (useWorker) {
    const { parseStreamInWorker } = await import(
      "./worker/parseStreamInWorker.ts"
    );
    return parseStreamInWorker(stream, options);
  }

  // Default: main thread streaming
  const { parseStreamInMain } = await import("./main/parseStreamInMain.ts");
  return parseStreamInMain(stream, options);
}

/**
 * Route binary parsing to appropriate execution environment using dynamic imports.
 *
 * @internal
 * @param binary CSV binary to parse
 * @param options Parsing options (including execution strategies)
 * @returns Async iterable iterator of records
 */
export async function routeBinaryParsing<Header extends ReadonlyArray<string>>(
  binary: Uint8Array | ArrayBuffer,
  options?: ParseBinaryOptions<Header>,
): Promise<AsyncIterableIterator<CSVRecord<Header>>> {
  const execution = options?.execution ?? [];
  const useWorker = execution.includes("worker");
  const useWASM = execution.includes("wasm");

  // Worker + WASM for binary
  if (useWorker && useWASM) {
    const { parseBinaryInWorkerWASM } = await import(
      "./worker/parseBinaryInWorker.ts"
    );
    return parseBinaryInWorkerWASM(binary, options);
  }

  // Worker only
  if (useWorker) {
    const { parseBinaryInWorker } = await import(
      "./worker/parseBinaryInWorker.ts"
    );
    return parseBinaryInWorker(binary, options);
  }

  // WASM only (main thread)
  if (useWASM) {
    const { parseBinaryInWASM } = await import("./wasm/parseBinaryInWASM.ts");
    return parseBinaryInWASM(binary, options);
  }

  // Default
  const { parseBinaryInMain } = await import("./main/parseBinaryInMain.ts");
  return parseBinaryInMain(binary, options);
}
