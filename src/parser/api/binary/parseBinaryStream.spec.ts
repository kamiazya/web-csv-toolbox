import fc from "fast-check";
import { describe, expect, it, test } from "vitest";
import { FC } from "@/__tests__/helper.ts";
import { parseBinaryStream } from "@/parser/api/binary/parseBinaryStream.ts";
import { escapeField } from "@/utils/serialization/escapeField.ts";

describe("parseBinaryStream function", () => {
  it("should parse CSV", () =>
    fc.assert(
      fc.asyncProperty(
        fc.gen().map((g) => {
          const header = g(FC.header, {
            // TextEncoderStream can't handle utf-16 string.
            fieldConstraints: {
              kindExcludes: ["string16bits"],
            },
          });
          const EOL = g(FC.eol);
          const csvData = g(FC.csvData, {
            // TextEncoderStream can't handle utf-16 string.
            fieldConstraints: {
              kindExcludes: ["string16bits"],
            },
            columnsConstraints: {
              minLength: header.length,
              maxLength: header.length,
            },
          });
          const EOF = g(fc.boolean);
          const csv = [
            header.map((v) => escapeField(v, { quote: true })).join(","),
            ...csvData.map((row) =>
              row.map((v) => escapeField(v, { quote: true })).join(","),
            ),
            ...(EOF ? [""] : []),
          ].join(EOL);
          const data =
            csvData.length >= 1
              ? csvData.map((row) =>
                  Object.fromEntries(row.map((v, i) => [header[i], v])),
                )
              : [];
          return {
            data,
            csv: new ReadableStream({
              start(controller) {
                controller.enqueue(csv);
                controller.close();
              },
            }).pipeThrough(new TextEncoderStream()),
          };
        }),
        async ({ data, csv }) => {
          let i = 0;
          for await (const row of parseBinaryStream(csv)) {
            expect(data[i++]).toStrictEqual(row);
          }
        },
      ),
    ));

  it("should parse CSV with BOM", async () => {
    const csv = new ReadableStream({
      start(controller) {
        controller.enqueue("\uFEFFa,b,c\n1,2,3");
        controller.close();
      },
    }).pipeThrough(new TextEncoderStream());
    const expected = [{ a: "1", b: "2", c: "3" }];
    let i = 0;
    for await (const row of parseBinaryStream(csv)) {
      expect(row).toStrictEqual(expected[i++]);
    }
  });

  it("should parse CSV with BOM and EOL", async () => {
    const csv = new ReadableStream({
      start(controller) {
        controller.enqueue("\uFEFFa,b,c\r\n1,2,3\r\n");
        controller.close();
      },
    }).pipeThrough(new TextEncoderStream());
    const expected = [{ a: "1", b: "2", c: "3" }];
    let i = 0;
    for await (const row of parseBinaryStream(csv)) {
      expect(row).toStrictEqual(expected[i++]);
    }
  });

  it("should parse decompressed CSV", () =>
    fc.assert(
      fc.asyncProperty(
        fc.gen().map((g) => {
          const header = g(FC.header, {
            // TextEncoderStream can't handle utf-16 string.
            fieldConstraints: {
              kindExcludes: ["string16bits"],
            },
          });
          const EOL = g(FC.eol);
          const csvData = g(FC.csvData, {
            // TextEncoderStream can't handle utf-16 string.
            fieldConstraints: {
              kindExcludes: ["string16bits"],
            },
            columnsConstraints: {
              minLength: header.length,
              maxLength: header.length,
            },
          });
          const EOF = g(fc.boolean);
          const csv = [
            header.map((v) => escapeField(v, { quote: true })).join(","),
            ...csvData.map((row) =>
              row.map((v) => escapeField(v, { quote: true })).join(","),
            ),
            ...(EOF ? [""] : []),
          ].join(EOL);
          const data =
            csvData.length >= 1
              ? csvData.map((row) =>
                  Object.fromEntries(row.map((v, i) => [header[i], v])),
                )
              : [];
          const decompression = g(() =>
            fc.constantFrom<CompressionFormat>(
              "gzip",
              "deflate",
              // NOTE: Node.js doesn't support raw deflate.
              // "deflate-raw",
            ),
          );
          return {
            data,
            csv: new ReadableStream({
              start(controller) {
                controller.enqueue(csv);
                controller.close();
              },
            })
              .pipeThrough(new TextEncoderStream())
              .pipeThrough(new CompressionStream(decompression)),
            decompression: decompression,
          };
        }),
        async ({ data, csv, decompression }) => {
          let i = 0;
          for await (const row of parseBinaryStream(csv, {
            decompression: decompression,
          })) {
            expect(data[i++]).toStrictEqual(row);
          }
        },
      ),
    ));
});

test("throws an error if the CSV is invalid", async () => {
  await expect(async () => {
    for await (const _ of parseBinaryStream(
      new ReadableStream({
        start(controller) {
          controller.enqueue('a\n"');
          controller.close();
        },
      }).pipeThrough(new TextEncoderStream()),
    )) {
      // Do nothing
    }
  }).rejects.toThrowErrorMatchingInlineSnapshot(
    `[ParseError: Unexpected EOF while parsing quoted field at line 2, column 1.]`,
  );
});
