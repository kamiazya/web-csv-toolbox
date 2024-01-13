import { expect, test } from "vitest";
import { parseStringStreamToStream } from "./parseStringStreamToStream.ts";
import { SingleValueReadableStream } from "./utils/SingleValueReadableStream.ts";

const csv = new SingleValueReadableStream(`name,age
Alice,42
Bob,69`);

const expected = [
  { name: "Alice", age: "42" },
  { name: "Bob", age: "69" },
];

test("stringStreamToStream", async () => {
  let i = 0;
  await parseStringStreamToStream(csv).pipeTo(
    new WritableStream({
      write(record) {
        expect(record).toEqual(expected[i++]);
      },
    }),
  );
});
