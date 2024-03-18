import { beforeAll, bench } from "vitest";
import { getAsBinary } from "./helper.ts";
import { parseBinaryToArraySync } from '../src/parseBinaryToArraySync';
import { parseBinaryToIterableIterator } from '../src/parseBinaryToIterableIterator';
import { parseBinaryToStream } from '../src/parseBinaryToStream';

let csv: ArrayBufferLike;
beforeAll(async () => {
  csv = await getAsBinary();
});

bench("parseBinaryToArraySync", () => {
  parseBinaryToArraySync(csv);
});

bench("parseBinaryToIterableIterator", async () => {
  for await (const _ of parseBinaryToIterableIterator(csv)) {
    // noop
  }
});

bench("parseBinaryToStream", async () => {
  await parseBinaryToStream(csv).pipeTo(new WritableStream({
    write(_) {
      // noop
    }
  }));
});
