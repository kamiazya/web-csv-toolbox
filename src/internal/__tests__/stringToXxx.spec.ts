import { expect, test } from "vitest";
import { stringToArraySync } from "../stringToArraySync.js";
import { stringToIterableIterator } from "../stringToIterableIterator.js";
import { stringToStream } from "../stringToStream.js";

const csv = `name,age
Alice,42
Bob,69`;

const expected = [
  { name: "Alice", age: "42" },
  { name: "Bob", age: "69" },
];

test("stringToIterableIterator", async () => {
  let i = 0;
  for (const record of stringToIterableIterator(csv)) {
    expect(record).toEqual(expected[i++]);
  }
});

test("stringToArraySync", async () => {
  expect(stringToArraySync(csv)).toEqual(expected);
});

test("stringToStream", async () => {
  let i = 0;
  await stringToStream(csv).pipeTo(
    new WritableStream({
      write(record) {
        expect(record).toEqual(expected[i++]);
      },
    }),
  );
});
