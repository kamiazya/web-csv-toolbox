import { expect, test } from "vitest";

import { parseStringToArraySync } from "./parseStringToArraySync";

const csv = `name,age
Alice,42
Bob,69`;

const expected = [
  { name: "Alice", age: "42" },
  { name: "Bob", age: "69" },
];

test("parseStringToArraySync", async () => {
  expect(parseStringToArraySync(csv)).toEqual(expected);
});

test("throws an error if the CSV is invalid", () => {
  expect(() =>
    parseStringToArraySync('a\n"'),
  ).toThrowErrorMatchingInlineSnapshot(
    // biome-ignore lint/style/noUnusedTemplateLiteral: This is a snapshot
    `[ParseError: Unexpected EOF while parsing quoted field.]`,
  );
});
