import { expect, test } from "vitest";
import { parseStringToArraySync } from "@/parser/api/string/parseStringToArraySync.ts";

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

test("supports WASM UTF-16 string mode via charset option", () => {
  const unicodeCsv = `名前,値
日本語,データ`;

  const result = parseStringToArraySync(unicodeCsv, {
    engine: { wasm: true },
    charset: "utf-16",
  });

  expect(result).toEqual([{ 名前: "日本語", 値: "データ" }]);
});

test("throws an error if the CSV is invalid", () => {
  expect(() =>
    parseStringToArraySync('a\n"'),
  ).toThrowErrorMatchingInlineSnapshot(
    `[ParseError: Unexpected EOF while parsing quoted field.]`,
  );
});
