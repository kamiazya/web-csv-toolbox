import { expect, test } from "vitest";

import { SingleValueReadableStream } from "@web-csv-toolbox/shared";

import { parseStringStreamToStream } from "./parseStringStreamToStream";

const csv = `name,age
Alice,42
Bob,69`;

const expected = [
  { name: "Alice", age: "42" },
  { name: "Bob", age: "69" },
];

test("parseStringStreamToStream", async () => {
  let i = 0;
  await parseStringStreamToStream(new SingleValueReadableStream(csv)).pipeTo(
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
      new SingleValueReadableStream('a\n"'),
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
