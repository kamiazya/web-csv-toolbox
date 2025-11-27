import type { CommandHandler } from "@/worker/handlers/types.ts";
import type { ParseBinaryRequest } from "@/worker/helpers/worker.shared.ts";
import { decodeBinaryToString } from "@/worker/utils/binaryDecodingUtils.ts";
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
 * Handler for parseBinary requests.
 * @internal
 */
export const parseBinaryHandler: CommandHandler<ParseBinaryRequest> = async (
  request,
  context,
) => {
  const { data, options, useWASM } = request;

  if (useWASM) {
    try {
      const decoded = await decodeBinaryToString(data, options);
      const { parseStringToArraySyncWASM } = await import(
        /* @vite-ignore */ parseStringToArrayWasmPath
      );
      await streamRecords(
        context.outputStrategy,
        parseStringToArraySyncWASM(decoded, options),
      );
      return;
    } catch {
      // Fall back to regular parser if WASM is not available
    }
  }

  const { parseBinaryToIterableIterator } = await import(
    "@/parser/api/binary/parseBinaryToIterableIterator.ts"
  );
  await streamRecords(
    context.outputStrategy,
    parseBinaryToIterableIterator(data, options),
  );
};
