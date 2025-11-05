import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { FC } from "./__tests__/helper.ts";
import { escapeField } from "./escapeField.ts";
import { parseBlob } from "./parseBlob.ts";

describe("parseBlob function", () => {
  it("should parse CSV from Blob", () =>
    fc.assert(
      fc.asyncProperty(
        fc.gen().map((g) => {
          const header = g(FC.header, {
            // TextEncoderStream can't handle utf-16 string.
            fieldConstraints: {
              kindExcludes: ["string16bits"],
            },
          });
          const BOM = g(fc.boolean);
          if (BOM) {
            // Add BOM to the first field.
            header[0] = `\ufeff${header[0]}`;
          }
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
          const encoder = new TextEncoder();
          return {
            data,
            blob: new Blob([encoder.encode(csv)], { type: "text/csv" }),
          };
        }),
        async ({ data, blob }) => {
          let i = 0;
          for await (const row of parseBlob(blob)) {
            expect(data[i++]).toStrictEqual(row);
          }
        },
      ),
    ));

  it("should parse CSV from Blob with charset in type", async () => {
    const csv = "name,age\nAlice,42\nBob,69";
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const expected = [
      { name: "Alice", age: "42" },
      { name: "Bob", age: "69" },
    ];

    let i = 0;
    for await (const row of parseBlob(blob)) {
      expect(row).toStrictEqual(expected[i++]);
    }
  });

  it("should parse CSV from Blob without type", async () => {
    const csv = "name,age\nAlice,42\nBob,69";
    const blob = new Blob([csv]);
    const expected = [
      { name: "Alice", age: "42" },
      { name: "Bob", age: "69" },
    ];

    let i = 0;
    for await (const row of parseBlob(blob)) {
      expect(row).toStrictEqual(expected[i++]);
    }
  });

  it("should parse CSV from File", async () => {
    const csv = "name,age\nAlice,42\nBob,69";
    const file = new File([csv], "test.csv", { type: "text/csv" });
    const expected = [
      { name: "Alice", age: "42" },
      { name: "Bob", age: "69" },
    ];

    let i = 0;
    for await (const row of parseBlob(file)) {
      expect(row).toStrictEqual(expected[i++]);
    }
  });

  it("should parse CSV using toArray method", async () => {
    const csv = "name,age\nAlice,42\nBob,69";
    const blob = new Blob([csv], { type: "text/csv" });
    const expected = [
      { name: "Alice", age: "42" },
      { name: "Bob", age: "69" },
    ];

    const records = await parseBlob.toArray(blob);
    expect(records).toStrictEqual(expected);
  });
});
