import { expect, test } from "vitest";
import { parseBinaryStreamToStream } from "@/parser/api/binary/parseBinaryStreamToStream.ts";

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

test("parseBinaryStreamToStream", async () => {
  let i = 0;
  await parseBinaryStreamToStream(csv).pipeTo(
    new WritableStream({
      write(record) {
        expect(record).toEqual(expected[i++]);
      },
    }),
  );
});

test("throws an error if the CSV is invalid", async () => {
  await expect(async () => {
    await parseBinaryStreamToStream(
      new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode('a\n"'));
          controller.close();
        },
      }),
    ).pipeTo(new WritableStream({ write() {} }));
  }).rejects.toThrowErrorMatchingInlineSnapshot(
    `[ParseError: Unexpected EOF while parsing quoted field at line 2, column 1.]`,
  );
});
