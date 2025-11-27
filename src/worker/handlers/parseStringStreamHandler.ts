import type { CommandHandler } from "@/worker/handlers/types.ts";
import type { ParseStringStreamRequest } from "@/worker/helpers/worker.shared.ts";
import { streamRecords } from "@/worker/utils/outputStrategy.ts";
import {
  buildCSVStreamPipeline,
  streamToAsyncIterator,
} from "@/worker/utils/streamPipelineFactory.ts";

/**
 * Handler for parseStringStream requests (TransferableStream strategy).
 * @internal
 */
export const parseStringStreamHandler: CommandHandler<
  ParseStringStreamRequest
> = async (request, context) => {
  // Support both 'stream' and 'data' properties for compatibility
  const stream = request.stream || request.data;

  if (!(stream instanceof ReadableStream)) {
    throw new Error(
      "parseStringStream requires 'stream' or 'data' property as ReadableStream. " +
        `Available properties: ${Object.keys(request).join(", ")}`,
    );
  }

  const resultStream = await buildCSVStreamPipeline(stream, request.options);
  const iterator = await streamToAsyncIterator(resultStream);

  await streamRecords(context.outputStrategy, iterator);
};
