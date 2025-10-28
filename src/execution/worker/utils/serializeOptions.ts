import type { ParseBinaryOptions, ParseOptions } from "../../../common/types.ts";

/**
 * Extract serializable options by removing non-serializable fields.
 * Removes: signal, workerPool, workerURL, engine (contains non-serializable objects)
 *
 * @internal
 */
export function serializeOptions<Header extends ReadonlyArray<string>>(
  options?: ParseOptions<Header> | ParseBinaryOptions<Header>,
): Omit<typeof options, "signal" | "workerPool" | "workerURL" | "engine"> | undefined {
  if (!options) return undefined;

  const {
    signal: _signal,
    workerPool: _workerPool,
    workerURL: _workerURL,
    engine: _engine,
    ...serializableOptions
  } = options;

  return serializableOptions;
}
