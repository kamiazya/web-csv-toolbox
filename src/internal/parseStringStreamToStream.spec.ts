import { expect, test } from "vitest";
import { parseStringStreamToStream } from "./parseStringStreamToStream.js";
import { SingleValueReadableStream } from "./utils/SingleValueReadableStream.js";

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
