import { expect, test } from "vitest";
import { parseStringStreamToStream } from "./parseStringStreamToStream.ts";

const csv = `name,age
Alice,42
Bob,69`;

const expected = [
  { name: "Alice", age: "42" },
  { name: "Bob", age: "69" },
];

test("parseStringStreamToStream", async () => {
  let i = 0;
  await parseStringStreamToStream(
    new ReadableStream({
      start(controller) {
        controller.enqueue(csv);
        controller.close();
      },
    }),
  ).pipeTo(
    new WritableStream({
      write(record) {
        expect(record).toEqual(expected[i++]);
      },
    }),
  );
});

test("throws an error if the CSV is invalid", async () => {
  await expect(async () => {
    await parseStringStreamToStream(
      new ReadableStream({
        start(controller) {
          controller.enqueue('a\n"');
          controller.close();
        },
      }),
    ).pipeTo(
      new WritableStream({
        write() {
          // Do nothing
        },
      }),
    );
  }).rejects.toThrowErrorMatchingInlineSnapshot(
    `[ParseError: Unexpected EOF while parsing quoted field.]`,
  );
});
