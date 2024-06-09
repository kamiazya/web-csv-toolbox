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
