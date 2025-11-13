import { expect, test } from "vitest";
import { parseBinaryToStream } from "../binary/parseBinaryToStream.ts";

const csv = new TextEncoder().encode(`name,age
Alice,42
Bob,69`);

const expected = [
  { name: "Alice", age: "42" },
  { name: "Bob", age: "69" },
];

test("parseBinaryToStream", async () => {
  let i = 0;
  await parseBinaryToStream(csv).pipeTo(
    new WritableStream({
      write(record) {
        expect(record).toEqual(expected[i++]);
      },
    }),
  );
});

test("throws an error if the binary is invalid", () => {
  expect(() =>
    parseBinaryToStream(new Uint8Array([0x80]), {
      fatal: true,
    }),
  ).toThrowError(TypeError); // NOTE: Error messages vary depending on the execution environment.
});
