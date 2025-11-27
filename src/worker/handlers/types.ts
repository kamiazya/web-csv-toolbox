import type {
  ParseRequest,
  WorkerContext,
} from "@/worker/helpers/worker.shared.ts";
import type { OutputStrategy } from "@/worker/utils/outputStrategy.ts";

/**
 * Context passed to command handlers.
 * @internal
 */
export interface HandlerContext {
  workerContext: WorkerContext;
  outputStrategy: OutputStrategy;
}

/**
 * Command handler function type.
 * @internal
 */
export type CommandHandler<T extends ParseRequest = ParseRequest> = (
  request: T,
  context: HandlerContext,
) => Promise<void>;
