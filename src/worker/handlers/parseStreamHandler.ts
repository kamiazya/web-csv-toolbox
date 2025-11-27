import type { CommandHandler } from "@/worker/handlers/types.ts";
import type { ParseStringStreamRequest } from "@/worker/helpers/worker.shared.ts";
import { streamRecords } from "@/worker/utils/outputStrategy.ts";
import {
  buildCSVStreamPipeline,
  streamToAsyncIterator,
} from "@/worker/utils/streamPipelineFactory.ts";

/**
 * Handler for parseStream requests (string stream via message-based strategy).
 * @internal
 */
export const parseStreamHandler: CommandHandler<
  ParseStringStreamRequest
> = async (request, context) => {
  const stream = request.data;

  if (!(stream instanceof ReadableStream)) {
    throw new Error("parseStream requires ReadableStream data");
  }

  const resultStream = await buildCSVStreamPipeline(stream, request.options);
  const iterator = await streamToAsyncIterator(resultStream);

  await streamRecords(context.outputStrategy, iterator);
};
