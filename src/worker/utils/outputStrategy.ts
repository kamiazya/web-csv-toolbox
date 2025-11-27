import type { CSVRecord } from "@/core/types.ts";
import type {
  ParseStreamResponse,
  WorkerContext,
} from "../helpers/worker.shared.ts";

/**
 * Output strategy interface for sending records from worker.
 * @internal
 */
export interface OutputStrategy<
  Header extends ReadonlyArray<string> = readonly string[],
> {
  sendRecord(record: CSVRecord<Header>): void;
  sendDone(): void;
  sendError(error: string): void;
}

/**
 * Output strategy for sending records to main thread via WorkerContext.
 * @internal
 */
export class MainThreadStrategy<
  Header extends ReadonlyArray<string> = readonly string[],
> implements OutputStrategy<Header>
{
  constructor(
    private readonly workerContext: WorkerContext<Header>,
    private readonly requestId: number,
  ) {}

  sendRecord(record: CSVRecord<Header>): void {
    const response: ParseStreamResponse<Header> = {
      id: this.requestId,
      type: "record",
      record,
    };
    this.workerContext.postMessage(response);
  }

  sendDone(): void {
    const response: ParseStreamResponse<Header> = {
      id: this.requestId,
      type: "done",
    };
    this.workerContext.postMessage(response);
  }

  sendError(error: string): void {
    const response: ParseStreamResponse<Header> = {
      id: this.requestId,
      type: "error",
      error,
    };
    this.workerContext.postMessage(response);
  }
}

/**
 * Output strategy for sending records to MessagePort.
 * @internal
 */
export class MessagePortStrategy<
  Header extends ReadonlyArray<string> = readonly string[],
> implements OutputStrategy<Header>
{
  constructor(private readonly port: MessagePort) {}

  sendRecord(record: CSVRecord<Header>): void {
    this.port.postMessage({
      type: "record",
      record,
    });
  }

  sendDone(): void {
    this.port.postMessage({ type: "done" });
  }

  sendError(error: string): void {
    this.port.postMessage({
      type: "error",
      error,
    });
  }
}

/**
 * Helper to stream records using an output strategy.
 * @internal
 */
export async function streamRecords<
  Header extends ReadonlyArray<string> = readonly string[],
>(
  strategy: OutputStrategy<Header>,
  records:
    | AsyncIterableIterator<CSVRecord<Header>>
    | Iterable<CSVRecord<Header>>,
): Promise<void> {
  try {
    for await (const record of records) {
      strategy.sendRecord(record);
    }
    strategy.sendDone();
  } catch (error) {
    strategy.sendError(error instanceof Error ? error.message : String(error));
  }
}
