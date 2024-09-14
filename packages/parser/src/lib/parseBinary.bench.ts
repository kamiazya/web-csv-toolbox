import { bench, describe } from "vitest";

import { getBinaryCSV } from "#/tests/utils/data";

import { parseBinary } from "./parseBinary.js";

describe.each([50, 100, 500, 1_000])("%d rows", (rows) => {
  const csv = getBinaryCSV(rows);

  bench("parse a binary CSV into an AsyncIterableIterator", async () => {
    for await (const _ of parseBinary(csv)) {
      // noop
    }
  });

  bench("parse a binary CSV into an Array", () => {
    parseBinary.toArraySync(csv);
  });

  bench("parse a binary CSV into a Promise<Array>", async () => {
    await parseBinary.toArray(csv);
  });

  bench("parse a binary CSV into a IterableIterator", () => {
    for (const _ of parseBinary.toIterableIterator(csv)) {
      // noop
    }
  });

  bench("parse a binary CSV into a ReadableStream", async () => {
    await parseBinary.toStream(csv).pipeTo(
      new WritableStream({
        write(_) {
          // noop
        },
      }),
    );
  });
});
