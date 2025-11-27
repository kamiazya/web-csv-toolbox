import type { CommandHandler } from "@/worker/handlers/types.ts";
import type { ParseStringRequest } from "@/worker/helpers/worker.shared.ts";
import { streamRecords } from "@/worker/utils/outputStrategy.ts";

/**
 * Build-time constant injected by Vite for worker bundle variants
 * @internal
 */
declare const __VARIANT__: "main" | "slim";

const parseStringToArrayWasmPath =
  typeof __VARIANT__ !== "undefined" && __VARIANT__ === "slim"
    ? "../../parser/api/string/parseStringToArraySyncWASM.slim.ts"
    : "../../parser/api/string/parseStringToArraySyncWASM.main.node.ts";

/**
 * Handler for parseString requests.
 * @internal
 */
export const parseStringHandler: CommandHandler<ParseStringRequest> = async (
  request,
  context,
) => {
  const { data, options, useWASM } = request;

  if (typeof data !== "string") {
    throw new Error("parseString requires string data");
  }

  if (useWASM) {
    try {
      const { parseStringToArraySyncWASM } = await import(
        /* @vite-ignore */ parseStringToArrayWasmPath
      );
      await streamRecords(
        context.outputStrategy,
        parseStringToArraySyncWASM(data, options),
      );
      return;
    } catch {
      // Fall back to regular parser if WASM is not available
    }
  }

  const { parseStringToIterableIterator } = await import(
    "@/parser/api/string/parseStringToIterableIterator.ts"
  );
  await streamRecords(
    context.outputStrategy,
    parseStringToIterableIterator(data, options),
  );
};
