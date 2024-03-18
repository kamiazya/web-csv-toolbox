import { beforeAll, bench } from "vitest";
import { getAsString } from "./helper.ts";
import { loadWASM } from "../src/loadWASM.ts";
import { parseStringToArraySyncWASM } from "../src/parseStringToArraySyncWASM.ts";
import { parseStringToArraySync } from "../src/parseStringToArraySync.ts";
import { parseStringToIterableIterator } from '../src/parseStringToIterableIterator.ts';
import { parseStringToStream } from '../src/parseStringToStream';

let csv: string;
beforeAll(async () => {
  await loadWASM();
  csv = await getAsString();
});

bench("parseStringToArraySync", () => {
  parseStringToArraySync(csv);
});

bench("parseStringToArraySyncWASM", () => {
  parseStringToArraySyncWASM(csv);
});

bench("parseStringToIterableIterator", async () => {
  for await (const _ of parseStringToIterableIterator(csv)) {
    // noop
  }
});

bench("parseStringToStream", async () => {
  await parseStringToStream(csv).pipeTo(new WritableStream({
    write(_) {
      // noop
    }
  }));
});
