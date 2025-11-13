import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { escapeField } from "../../../utils/serialization/escapeField.ts";
import { FC } from "./__tests__/helper.ts";
import { parse } from "./parse.ts";

describe("parse function", () => {
  it("should parse CSV string", () =>
    fc.assert(
      fc.asyncProperty(
        fc.gen().map((g) => {
          const header = g(FC.header);
          const EOL = g(FC.eol);
          const EOF = g(fc.boolean);
          const csvData = [
            ...g(FC.csvData, {
              rowsConstraints: {
                minLength: 1,
              },
              columnsConstraints: {
                minLength: header.length,
                maxLength: header.length,
              },
            }),
            // Last row is not empty for testing.
            g(FC.row, {
              fieldConstraints: {
                minLength: 1,
              },
              columnsConstraints: {
                minLength: header.length,
                maxLength: header.length,
              },
            }),
          ];
          const csv = [
            header.map((v) => escapeField(v)).join(","),
            EOL,
            ...csvData.flatMap((row, i) => [
              ...row.map((v) => escapeField(v)).join(","),
              ...(EOF || csvData.length - 1 !== i ? [EOL] : []),
            ]),
          ].join("");
          const data = csvData.map((row) =>
            Object.fromEntries(row.map((v, i) => [header[i], v])),
          );
          return { data, csv };
        }),
        async ({ data, csv }) => {
          let i = 0;
          for await (const row of parse(csv)) {
            expect(row).toEqual(data[i++]);
          }
        },
      ),
      {
        examples: [
          [{ csv: "a,b,c\n1,2,3", data: [{ a: "1", b: "2", c: "3" }] }],
          [{ csv: "a,b,c\n1,,3", data: [{ a: "1", b: "", c: "3" }] }],
          [{ csv: "a,b,c\n1,2,3\n", data: [{ a: "1", b: "2", c: "3" }] }],
          [
            {
              csv: "a,b,c\n\n1,2,3",
              data: [
                { a: "", b: "", c: "" },
                { a: "1", b: "2", c: "3" },
              ],
            },
          ],
        ],
      },
    ));

  it("should parse Uint8Arrayed CSV", () =>
    fc.assert(
      fc.asyncProperty(
        fc.gen().map((g) => {
          const header = g(FC.header, {
            fieldConstraints: {
              kindExcludes: ["string16bits"],
            },
          });
          const EOL = g(FC.eol);
          const EOF = g(fc.boolean);
          const csvData = [
            ...g(FC.csvData, {
              rowsConstraints: {
                minLength: 1,
              },
              columnsConstraints: {
                minLength: header.length,
                maxLength: header.length,
              },
              fieldConstraints: {
                kindExcludes: ["string16bits"],
              },
            }),
            // Last row is not empty for testing.
            g(FC.row, {
              fieldConstraints: {
                minLength: 1,
                kindExcludes: ["string16bits"],
              },
              columnsConstraints: {
                minLength: header.length,
                maxLength: header.length,
              },
            }),
          ];
          const csv = [
            header.map((v) => escapeField(v)).join(","),
            EOL,
            ...csvData.flatMap((row, i) => [
              ...row.map((v) => escapeField(v)).join(","),
              ...(EOF || csvData.length - 1 !== i ? [EOL] : []),
            ]),
          ].join("");
          const data = csvData.map((row) =>
            Object.fromEntries(row.map((v, i) => [header[i], v])),
          );
          return { data, csv: new TextEncoder().encode(csv) };
        }),
        async ({ data, csv }) => {
          let i = 0;
          for await (const row of parse(csv)) {
            expect(row).toEqual(data[i++]);
          }
        },
      ),
    ));

  it("should parse ArrayBuffered CSV", () =>
    fc.assert(
      fc.asyncProperty(
        fc.gen().map((g) => {
          const header = g(FC.header, {
            fieldConstraints: {
              kindExcludes: ["string16bits"],
            },
          });
          const EOL = g(FC.eol);
          const EOF = g(fc.boolean);
          const csvData = [
            ...g(FC.csvData, {
              rowsConstraints: {
                minLength: 1,
              },
              columnsConstraints: {
                minLength: header.length,
                maxLength: header.length,
              },
              fieldConstraints: {
                kindExcludes: ["string16bits"],
              },
            }),
            // Last row is not empty for testing.
            g(FC.row, {
              fieldConstraints: {
                minLength: 1,
                kindExcludes: ["string16bits"],
              },
              columnsConstraints: {
                minLength: header.length,
                maxLength: header.length,
              },
            }),
          ];
          const csv = [
            header.map((v) => escapeField(v)).join(","),
            EOL,
            ...csvData.flatMap((row, i) => [
              ...row.map((v) => escapeField(v)).join(","),
              ...(EOF || csvData.length - 1 !== i ? [EOL] : []),
            ]),
          ].join("");
          const data = csvData.map((row) =>
            Object.fromEntries(row.map((v, i) => [header[i], v])),
          );
          return {
            data,
            csv: new TextEncoder().encode(csv).buffer,
          };
        }),
        async ({ data, csv }) => {
          let i = 0;
          for await (const row of parse(csv)) {
            expect(row).toEqual(data[i++]);
          }
        },
      ),
    ));

  it("should parse StringReadableStream CSV", () =>
    fc.assert(
      fc.asyncProperty(
        fc.gen().map((g) => {
          const header = g(FC.header);
          const EOL = g(FC.eol);
          const EOF = g(fc.boolean);
          const csvData = [
            ...g(FC.csvData, {
              rowsConstraints: {
                minLength: 1,
              },
              columnsConstraints: {
                minLength: header.length,
                maxLength: header.length,
              },
            }),
            // Last row is not empty for testing.
            g(FC.row, {
              fieldConstraints: {
                minLength: 1,
              },
              columnsConstraints: {
                minLength: header.length,
                maxLength: header.length,
              },
            }),
          ];
          const csv = [
            header.map((v) => escapeField(v)).join(","),
            EOL,
            ...csvData.flatMap((row, i) => [
              ...row.map((v) => escapeField(v)).join(","),
              ...(EOF || csvData.length - 1 !== i ? [EOL] : []),
            ]),
          ].join("");
          const data = csvData.map((row) =>
            Object.fromEntries(row.map((v, i) => [header[i], v])),
          );
          return {
            data,
            csv: new ReadableStream({
              start(controller) {
                controller.enqueue(csv);
                controller.close();
              },
            }),
          };
        }),
        async ({ data, csv }) => {
          let i = 0;
          for await (const row of parse(csv)) {
            expect(row).toEqual(data[i++]);
          }
        },
      ),
    ));
  it("should parse Uint8ArrayReadableStream CSV", () =>
    fc.assert(
      fc.asyncProperty(
        fc.gen().map((g) => {
          const header = g(FC.header, {
            fieldConstraints: {
              kindExcludes: ["string16bits"],
            },
          });
          const EOL = g(FC.eol);
          const EOF = g(fc.boolean);
          const csvData = [
            ...g(FC.csvData, {
              rowsConstraints: {
                minLength: 1,
              },
              columnsConstraints: {
                minLength: header.length,
                maxLength: header.length,
              },
              fieldConstraints: {
                kindExcludes: ["string16bits"],
              },
            }),
            // Last row is not empty for testing.
            g(FC.row, {
              fieldConstraints: {
                minLength: 1,
                kindExcludes: ["string16bits"],
              },
              columnsConstraints: {
                minLength: header.length,
                maxLength: header.length,
              },
            }),
          ];
          const csv = [
            header.map((v) => escapeField(v)).join(","),
            EOL,
            ...csvData.flatMap((row, i) => [
              ...row.map((v) => escapeField(v)).join(","),
              ...(EOF || csvData.length - 1 !== i ? [EOL] : []),
            ]),
          ].join("");
          const data = csvData.map((row) =>
            Object.fromEntries(row.map((v, i) => [header[i], v])),
          );
          return {
            data,
            csv: new ReadableStream({
              start(controller) {
                controller.enqueue(new TextEncoder().encode(csv));
                controller.close();
              },
            }),
          };
        }),
        async ({ data, csv }) => {
          let i = 0;
          for await (const row of parse(csv)) {
            expect(row).toEqual(data[i++]);
          }
        },
      ),
    ));

  it("should parse CSV Response", () =>
    fc.assert(
      fc.asyncProperty(
        fc.gen().map((g) => {
          const header = g(FC.header, {
            fieldConstraints: {
              kindExcludes: ["string16bits"],
            },
          });
          const EOL = g(FC.eol);
          const EOF = g(fc.boolean);
          const csvData = [
            ...g(FC.csvData, {
              rowsConstraints: {
                minLength: 1,
              },
              columnsConstraints: {
                minLength: header.length,
                maxLength: header.length,
              },
              fieldConstraints: {
                kindExcludes: ["string16bits"],
              },
            }),
            // Last row is not empty for testing.
            g(FC.row, {
              fieldConstraints: {
                minLength: 1,
                kindExcludes: ["string16bits"],
              },
              columnsConstraints: {
                minLength: header.length,
                maxLength: header.length,
              },
            }),
          ];
          const csv = [
            header.map((v) => escapeField(v)).join(","),
            EOL,
            ...csvData.flatMap((row, i) => [
              ...row.map((v) => escapeField(v)).join(","),
              ...(EOF || csvData.length - 1 !== i ? [EOL] : []),
            ]),
          ].join("");
          const data = csvData.map((row) =>
            Object.fromEntries(row.map((v, i) => [header[i], v])),
          );
          return {
            data,
            csv: new Response(
              new ReadableStream({
                start(controller) {
                  controller.enqueue(new TextEncoder().encode(csv));
                  controller.close();
                },
              }),
              { headers: { "content-type": "text/csv" } },
            ),
          };
        }),
        async ({ data, csv }) => {
          let i = 0;
          for await (const row of parse(csv)) {
            expect(row).toEqual(data[i++]);
          }
        },
      ),
    ));

  it("should parse CSV Request", () =>
    fc.assert(
      fc.asyncProperty(
        fc.gen().map((g) => {
          const header = g(FC.header, {
            fieldConstraints: {
              kindExcludes: ["string16bits"],
            },
          });
          const EOL = g(FC.eol);
          const EOF = g(fc.boolean);
          const csvData = [
            ...g(FC.csvData, {
              rowsConstraints: {
                minLength: 1,
              },
              columnsConstraints: {
                minLength: header.length,
                maxLength: header.length,
              },
              fieldConstraints: {
                kindExcludes: ["string16bits"],
              },
            }),
            // Last row is not empty for testing.
            g(FC.row, {
              fieldConstraints: {
                minLength: 1,
                kindExcludes: ["string16bits"],
              },
              columnsConstraints: {
                minLength: header.length,
                maxLength: header.length,
              },
            }),
          ];
          const csv = [
            header.map((v) => escapeField(v)).join(","),
            EOL,
            ...csvData.flatMap((row, i) => [
              ...row.map((v) => escapeField(v)).join(","),
              ...(EOF || csvData.length - 1 !== i ? [EOL] : []),
            ]),
          ].join("");
          const data = csvData.map((row) =>
            Object.fromEntries(row.map((v, i) => [header[i], v])),
          );
          return {
            data,
            csv: new Request("https://example.com", {
              method: "POST",
              headers: { "content-type": "text/csv" },
              body: new ReadableStream({
                start(controller) {
                  controller.enqueue(new TextEncoder().encode(csv));
                  controller.close();
                },
              }),
              // @ts-expect-error - duplex is required in Node.js but not in the types yet
              duplex: "half",
            }),
          };
        }),
        async ({ data, csv }) => {
          let i = 0;
          for await (const row of parse(csv)) {
            expect(row).toEqual(data[i++]);
          }
        },
      ),
    ));

  it("should parse CSV Blob", () =>
    fc.assert(
      fc.asyncProperty(
        fc.gen().map((g) => {
          const header = g(FC.header, {
            fieldConstraints: {
              kindExcludes: ["string16bits"],
            },
          });
          const EOL = g(FC.eol);
          const EOF = g(fc.boolean);
          const csvData = [
            ...g(FC.csvData, {
              rowsConstraints: {
                minLength: 1,
              },
              columnsConstraints: {
                minLength: header.length,
                maxLength: header.length,
              },
              fieldConstraints: {
                kindExcludes: ["string16bits"],
              },
            }),
            // Last row is not empty for testing.
            g(FC.row, {
              fieldConstraints: {
                minLength: 1,
                kindExcludes: ["string16bits"],
              },
              columnsConstraints: {
                minLength: header.length,
                maxLength: header.length,
              },
            }),
          ];
          const csv = [
            header.map((v) => escapeField(v)).join(","),
            EOL,
            ...csvData.flatMap((row, i) => [
              ...row.map((v) => escapeField(v)).join(","),
              ...(EOF || csvData.length - 1 !== i ? [EOL] : []),
            ]),
          ].join("");
          const data = csvData.map((row) =>
            Object.fromEntries(row.map((v, i) => [header[i], v])),
          );
          return {
            data,
            csv: new Blob([new TextEncoder().encode(csv)], {
              type: "text/csv",
            }),
          };
        }),
        async ({ data, csv }) => {
          let i = 0;
          for await (const row of parse(csv)) {
            expect(row).toEqual(data[i++]);
          }
        },
      ),
    ));

  it("should handle skipEmptyLines option correctly", () =>
    fc.assert(
      fc.asyncProperty(
        fc.gen().map((g) => {
          // Random header
          const header = g(FC.header, {
            fieldConstraints: { kindExcludes: ["string16bits"] },
          });
          const EOL = g(FC.eol);
          const EOF = g(fc.boolean);

          // Random CSV rows with occasional empty lines
          const csvData = [
            ...g(FC.csvData, {
              rowsConstraints: { minLength: 1 },
              columnsConstraints: {
                minLength: header.length,
                maxLength: header.length,
              },
              fieldConstraints: { kindExcludes: ["string16bits"] },
            }),
            [],
          ];

          const csv = [
            header.map((v) => escapeField(v)).join(","),
            EOL,
            ...csvData.flatMap((row, i) => [
              row.length === 0 ? "" : row.map((v) => escapeField(v)).join(","),
              ...(EOF || csvData.length - 1 !== i ? [EOL] : []),
            ]),
          ].join("");

          //Add edge cases (bot-recommended) occasionally
          const edgeCases = [
            { header, csv: "\na,b\n1,2" }, // empty line before header
            { header, csv: "a,b\n\n\n1,2" }, // multiple empty lines in middle
            { header, csv: "a,b\n1,2\n\n" }, // trailing empty lines
            { header, csv: "a,b\n\n1,2\n\n3,4\n\n\n5,6" }, // mixed empty lines
            { header, csv: "a,b\n1,2\n3,4" }, // no empty lines
          ];

          // Return random edge case or generated CSV
          return Math.random() < 0.3
            ? edgeCases[Math.floor(Math.random() * edgeCases.length)]
            : { header, csv };
        }),
        async ({ header, csv }) => {
          try {
            // skipEmptyLines = true
            const resultSkipped: any[] = [];
            for await (const record of parse(csv, {
              header,
              skipEmptyLines: true,
            })) {
              resultSkipped.push(record);
            }
            //skipEmptyLines = false
            const resultAll: any[] = [];
            for await (const record of parse(csv, {
              header,
              skipEmptyLines: false,
            })) {
              resultAll.push(record);
            }
            // Property: skipping empty lines never increases record count
            expect(resultSkipped.length).toBeLessThanOrEqual(resultAll.length);
          } catch (err: any) {
            // ignore malformed CSVs (unterminated quotes, etc.)
            if (!/Unexpected EOF|ParseError/i.test(err.message)) {
              throw err;
            }
          }
        },
      ),
      { verbose: true },
    ));
});
