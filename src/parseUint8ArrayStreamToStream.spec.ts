import { expect, test } from "vitest";
import { parseUint8ArrayStreamToStream } from "./parseUint8ArrayStreamToStream.ts";
import { SingleValueReadableStream } from "./utils/SingleValueReadableStream.ts";

const CSV_STRING = `name,age
Alice,42
Bob,69`;

const expected = [
  { name: "Alice", age: "42" },
  { name: "Bob", age: "69" },
];

test("parseUint8ArrayStreamToStream", async () => {
  let i = 0;
  const csv = new SingleValueReadableStream(
    new TextEncoder().encode(CSV_STRING),
  );
  await parseUint8ArrayStreamToStream(csv).pipeTo(
    new WritableStream({
      write(record) {
        expect(record).toEqual(expected[i++]);
      },
    }),
  );
});

test("parseUint8ArrayStreamToStream (ignoreBOM by default)", async () => {
  const csvWithBOM = new SingleValueReadableStream(
    new Uint8Array([0xef, 0xbb, 0xbf, ...new TextEncoder().encode(CSV_STRING)]),
  );

  let i = 0;
  await parseUint8ArrayStreamToStream(csvWithBOM).pipeTo(
    new WritableStream({
      write(record) {
        expect(record).toEqual(expected[i++]);
      },
    }),
  );
});
