import type { ParseBinaryOptions, ParseOptions } from "../../../common/types.ts";

/**
 * Extract serializable options by removing non-serializable fields.
 * Removes: signal, workerPool, workerURL
 *
 * @internal
 */
export function serializeOptions<Header extends ReadonlyArray<string>>(
  options?: ParseOptions<Header> | ParseBinaryOptions<Header>,
): Omit<typeof options, "signal" | "workerPool" | "workerURL"> | undefined {
  if (!options) return undefined;

  const {
    signal: _signal,
    workerPool: _workerPool,
    workerURL: _workerURL,
    ...serializableOptions
  } = options;

  return serializableOptions;
}
