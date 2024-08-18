import { expect, test } from "vitest";
import { parseBinaryToArraySync } from "./parseBinaryToArraySync.ts";

const csv = new TextEncoder().encode(`name,age
Alice,42
Bob,69`);

const expected = [
  { name: "Alice", age: "42" },
  { name: "Bob", age: "69" },
];

test("parseBinaryToArraySync", async () => {
  expect(parseBinaryToArraySync(csv)).toEqual(expected);
});

test("throws an error if the binary is invalid", () => {
  expect(() =>
    parseBinaryToArraySync(new Uint8Array([0x80]), {
      fatal: true,
    }),
  ).toThrowErrorMatchingInlineSnapshot(
    // biome-ignore lint/style/noUnusedTemplateLiteral: This is a snapshot
    `[TypeError: The encoded data was not valid for encoding utf-8]`,
  );
});
