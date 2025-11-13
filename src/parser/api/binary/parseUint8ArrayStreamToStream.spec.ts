import { expect, test } from "vitest";
import { parseUint8ArrayStreamToStream } from "./parseUint8ArrayStreamToStream.ts";

const csv = new ReadableStream({
  start(controller) {
    controller.enqueue(
      new TextEncoder().encode(
        `name,age
Alice,42
Bob,69`,
      ),
    );
    controller.close();
  },
});

const expected = [
  { name: "Alice", age: "42" },
  { name: "Bob", age: "69" },
];

test("parseUint8ArrayStreamToStream", async () => {
  let i = 0;
  await parseUint8ArrayStreamToStream(csv).pipeTo(
    new WritableStream({
      write(record) {
        expect(record).toEqual(expected[i++]);
      },
    }),
  );
});

test("throws an error if the CSV is invalid", async () => {
  await expect(async () => {
    await parseUint8ArrayStreamToStream(
      new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode('a\n"'));
          controller.close();
        },
      }),
    ).pipeTo(
      new WritableStream({
        write() {},
      }),
    );
  }).rejects.toThrowErrorMatchingInlineSnapshot(
    `[ParseError: Unexpected EOF while parsing quoted field.]`,
  );
});
