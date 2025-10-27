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
export async function* routeUint8ArrayStreamParsing<
  Header extends ReadonlyArray<string>,
>(
  stream: ReadableStream<Uint8Array>,
  options?: ParseBinaryOptions<Header>,
): AsyncIterableIterator<CSVRecord<Header>> {
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
      "#execution/worker/parseUint8ArrayStreamInWorker.js"
    );
    yield* parseUint8ArrayStreamInWorker(stream, options);
    return;
  }

  // Default: main thread streaming
  const { parseUint8ArrayStreamInMain } = await import(
    "./main/parseUint8ArrayStreamInMain.ts"
  );
  yield* parseUint8ArrayStreamInMain(stream, options);
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
export async function* routeStringParsing<Header extends ReadonlyArray<string>>(
  csv: string,
  options?: ParseOptions<Header>,
): AsyncIterableIterator<CSVRecord<Header>> {
  const execution = options?.execution ?? [];
  const useWorker = execution.includes("worker");
  const useWASM = execution.includes("wasm");

  // Case 1: Worker + WASM
  if (useWorker && useWASM) {
    const { parseStringInWorkerWASM } = await import(
      "#execution/worker/parseStringInWorkerWASM.js"
    );
    yield* parseStringInWorkerWASM(csv, options);
    return;
  }

  // Case 2: Worker only
  if (useWorker) {
    const { parseStringInWorker } = await import(
      "#execution/worker/parseStringInWorker.js"
    );
    yield* parseStringInWorker(csv, options);
    return;
  }

  // Case 3: WASM only (main thread)
  if (useWASM) {
    const { parseStringInWASM } = await import("./wasm/parseStringInWASM.ts");
    yield* parseStringInWASM(csv, options);
    return;
  }

  // Case 4: Default (main thread, no WASM)
  const { parseStringInMain } = await import("./main/parseStringInMain.ts");
  yield* parseStringInMain(csv, options);
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
export async function* routeStreamParsing<Header extends ReadonlyArray<string>>(
  stream: ReadableStream<string>,
  options?: ParseOptions<Header>,
): AsyncIterableIterator<CSVRecord<Header>> {
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
      "#execution/worker/parseStreamInWorker.js"
    );
    yield* parseStreamInWorker(stream, options);
    return;
  }

  // Default: main thread streaming
  const { parseStreamInMain } = await import("./main/parseStreamInMain.ts");
  yield* parseStreamInMain(stream, options);
}

/**
 * Route binary parsing to appropriate execution environment using dynamic imports.
 *
 * @internal
 * @param binary CSV binary to parse
 * @param options Parsing options (including execution strategies)
 * @returns Async iterable iterator of records
 */
export async function* routeBinaryParsing<Header extends ReadonlyArray<string>>(
  binary: Uint8Array | ArrayBuffer,
  options?: ParseBinaryOptions<Header>,
): AsyncIterableIterator<CSVRecord<Header>> {
  const execution = options?.execution ?? [];
  const useWorker = execution.includes("worker");
  const useWASM = execution.includes("wasm");

  // Worker + WASM for binary
  if (useWorker && useWASM) {
    const { parseBinaryInWorkerWASM } = await import(
      "#execution/worker/parseBinaryInWorkerWASM.js"
    );
    yield* parseBinaryInWorkerWASM(binary, options);
    return;
  }

  // Worker only
  if (useWorker) {
    const { parseBinaryInWorker } = await import(
      "#execution/worker/parseBinaryInWorker.js"
    );
    yield* parseBinaryInWorker(binary, options);
    return;
  }

  // WASM only (main thread)
  if (useWASM) {
    const { parseBinaryInWASM } = await import("./wasm/parseBinaryInWASM.ts");
    yield* parseBinaryInWASM(binary, options);
    return;
  }

  // Default
  const { parseBinaryInMain } = await import("./main/parseBinaryInMain.ts");
  yield* parseBinaryInMain(binary, options);
}
