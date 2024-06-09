import { expect, test } from "vitest";
import { parseUint8ArrayStreamToStream } from "./parseUint8ArrayStreamToStream.ts";
import { SingleValueReadableStream } from "./utils/SingleValueReadableStream.ts";

const csv = new SingleValueReadableStream(
  new TextEncoder().encode(
    `name,age
Alice,42
Bob,69`,
  ),
);

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
      new SingleValueReadableStream(new TextEncoder().encode('a\n"')),
    ).pipeTo(
      new WritableStream({
        write() {
          // Do nothing
        },
      }),
    );
  }).rejects.toThrowErrorMatchingInlineSnapshot(
    // biome-ignore lint/style/noUnusedTemplateLiteral: This is a snapshot
    `[ParseError: Unexpected EOF while parsing quoted field.]`,
  );
});
