import { expect, test } from "vitest";
import { parseStringToArraySync } from "../string/parseStringToArraySync.ts";

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
    `[ParseError: Unexpected EOF while parsing quoted field.]`,
  );
});
