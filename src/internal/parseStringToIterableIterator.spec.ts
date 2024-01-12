import { expect, test } from "vitest";
import { parseStringToIterableIterator } from "./parseStringToIterableIterator.js";

const csv = `name,age
Alice,42
Bob,69`;

const expected = [
  { name: "Alice", age: "42" },
  { name: "Bob", age: "69" },
];

test("parseStringToIterableIterator", async () => {
  let i = 0;
  for (const record of parseStringToIterableIterator(csv)) {
    expect(record).toEqual(expected[i++]);
  }
});