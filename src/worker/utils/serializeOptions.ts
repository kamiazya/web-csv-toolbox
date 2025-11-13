import type {
  DEFAULT_DELIMITER,
  DEFAULT_QUOTATION,
} from "../../core/constants.ts";
import type { ParseBinaryOptions, ParseOptions } from "../../core/types.ts";

/**
 * Extract serializable options by removing non-serializable fields.
 * Removes: signal, engine, workerPool, workerURL (contains non-serializable objects)
 *
 * @internal
 */
export function serializeOptions<
  Header extends ReadonlyArray<string> = readonly string[],
  Delimiter extends string = DEFAULT_DELIMITER,
  Quotation extends string = DEFAULT_QUOTATION,
>(
  options?:
    | ParseOptions<Header, Delimiter, Quotation>
    | ParseBinaryOptions<Header, Delimiter, Quotation>,
):
  | Omit<typeof options, "signal" | "engine" | "workerPool" | "workerURL">
  | undefined {
  if (!options) return undefined;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const {
    signal: _signal,
    engine: _engine,
    workerPool: _workerPool,
    workerURL: _workerURL,
    ...serializableOptions
  } = options as any;

  return serializableOptions;
}
