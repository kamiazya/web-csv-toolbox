import { expect, test } from "vitest";
import { parseStringToStream } from "./parseStringToStream.js";

const csv = `name,age
Alice,42
Bob,69`;

const expected = [
  { name: "Alice", age: "42" },
  { name: "Bob", age: "69" },
];

test("parseStringToStream", async () => {
  let i = 0;
  await parseStringToStream(csv).pipeTo(
    new WritableStream({
      write(record) {
        expect(record).toEqual(expected[i++]);
      },
    }),
  );
});
