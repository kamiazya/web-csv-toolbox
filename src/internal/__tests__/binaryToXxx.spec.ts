import { expect, test } from "vitest";
import { binaryToArraySync } from "../binaryToArraySync";
import { binaryToIterableIterator } from "../binaryToIterableIterator";
import { binaryToStream } from "../binaryToStream";

const csv = new TextEncoder().encode(`name,age
Alice,42
Bob,69`);

const expected = [
  { name: "Alice", age: "42" },
  { name: "Bob", age: "69" },
];

test("binaryToIterableIterator", async () => {
  let i = 0;
  for (const record of binaryToIterableIterator(csv)) {
    expect(record).toEqual(expected[i++]);
  }
});

test("binaryToArraySync", async () => {
  expect(binaryToArraySync(csv)).toEqual(expected);
});

test("binaryToStream", async () => {
  let i = 0;
  await binaryToStream(csv).pipeTo(
    new WritableStream({
      write(record) {
        expect(record).toEqual(expected[i++]);
      },
    }),
  );
});
