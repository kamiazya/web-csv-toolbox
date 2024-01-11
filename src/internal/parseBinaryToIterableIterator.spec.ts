import { expect, test } from "vitest";
import { parseBinaryToIterableIterator } from "./parseBinaryToIterableIterator.js";

const csv = new TextEncoder().encode(`name,age
Alice,42
Bob,69`);

const expected = [
  { name: "Alice", age: "42" },
  { name: "Bob", age: "69" },
];

test("parseBinaryToIterableIterator", async () => {
  let i = 0;
  for (const record of parseBinaryToIterableIterator(csv)) {
    expect(record).toEqual(expected[i++]);
  }
});
