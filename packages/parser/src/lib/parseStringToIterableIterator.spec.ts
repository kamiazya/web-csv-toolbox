import { expect, test } from "vitest";

import { parseStringToIterableIterator } from "./parseStringToIterableIterator";

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

test("throws an error if the CSV is invalid", () => {
  expect(() => {
    for (const _ of parseStringToIterableIterator('a\n"')) {
      // Do nothing
    }
  }).toThrowErrorMatchingInlineSnapshot(
    // biome-ignore lint/style/noUnusedTemplateLiteral: This is a snapshot
    `[ParseError: Unexpected EOF while parsing quoted field.]`,
  );
});
