import { expect, test } from "vitest";
import { parseBinaryToStream } from "@/parser/api/binary/parseBinaryToStream.ts";

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

test("throws an error if the binary is invalid", async () => {
  // Note: After refactoring to use parseBinaryStreamToStream, errors are thrown asynchronously
  // when the stream is consumed, not when the stream is created
  const stream = parseBinaryToStream(new Uint8Array([0x80]), {
    fatal: true,
  });

  // Consume the stream to trigger the error
  const reader = stream.getReader();
  await expect(reader.read()).rejects.toThrow(); // Error occurs during stream consumption
});
