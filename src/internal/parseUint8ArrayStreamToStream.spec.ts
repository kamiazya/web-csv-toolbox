import { expect, test } from "vitest";
import { SingleValueReadableStream } from "./SingleValueReadableStream";
import { parseUint8ArrayStreamToStream } from "./parseUint8ArrayStreamToStream";

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
