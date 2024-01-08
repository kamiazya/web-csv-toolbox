import { expect, test } from "vitest";
import { SingleValueReadableStream } from "../SingleValueReadableStream";
import { uint8ArrayStreamToStream } from "../uint8ArrayStreamToStream";

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

test("uint8ArrayStreamToStream", async () => {
  let i = 0;
  await uint8ArrayStreamToStream(csv).pipeTo(
    new WritableStream({
      write(record) {
        expect(record).toEqual(expected[i++]);
      },
    }),
  );
});
