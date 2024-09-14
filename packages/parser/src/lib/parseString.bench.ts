import { bench, describe } from "vitest";

import { getStringCSV } from "#/tests/utils/data";

import { parseString } from "./parseString.js";

describe.each([50, 100, 500, 1_000])("%d rows", (rows) => {
  const string = getStringCSV(rows);

  bench("parse a string CSV to an AsyncIterableIterator", async () => {
    for await (const _ of parseString(string)) {
      // noop
    }
  });

  bench("parse a string CSV to an Array", () => {
    parseString.toArraySync(string);
  });

  bench("parse a string CSV to a Promise<Array>", async () => {
    await parseString.toArray(string);
  });

  bench("parse a string CSV to a IterableIterator", () => {
    for (const _ of parseString.toIterableIterator(string)) {
      // noop
    }
  });

  bench("parse a string CSV to a ReadableStream", async () => {
    await parseString.toStream(string).pipeTo(
      new WritableStream({
        write(_) {
          // noop
        },
      }),
    );
  });
});
