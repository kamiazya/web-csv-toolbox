import { beforeAll, expect, test } from "vitest";
import { parseStringToIterableIterator } from "@/parser/api/string/parseStringToIterableIterator.ts";
import { loadWASM } from "@/wasm/WasmInstance.main.web.ts";

const csv = `name,age
Alice,42
Bob,69`;

const expected = [
  { name: "Alice", age: "42" },
  { name: "Bob", age: "69" },
];

beforeAll(async () => {
  await loadWASM();
});

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
    `[ParseError: Unexpected EOF while parsing quoted field.]`,
  );
});

test("supports WASM UTF-16 mode via charset option", () => {
  const unicodeCsv = `名前,値
日本語,データ
終わり,値2`;

  const results: Array<Record<string, string>> = [];
  for (const row of parseStringToIterableIterator(unicodeCsv, {
    engine: { wasm: true },
    charset: "utf-16",
  })) {
    results.push(row as Record<string, string>);
  }

  expect(results).toEqual([
    { 名前: "日本語", 値: "データ" },
    { 名前: "終わり", 値: "値2" },
  ]);
});

test("supports WASM UTF-16 mode with array output", () => {
  const unicodeCsv = `名前,値
日本語,データ`;

  const results: (readonly string[])[] = [];
  for (const row of parseStringToIterableIterator(unicodeCsv, {
    engine: { wasm: true },
    charset: "utf-16",
    outputFormat: "array",
    includeHeader: true,
  })) {
    results.push(row);
  }

  expect(results).toEqual([
    ["名前", "値"],
    ["日本語", "データ"],
  ]);
});
