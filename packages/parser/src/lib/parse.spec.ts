import { fc } from "@fast-check/vitest";
import { describe, expect, it } from "vitest";

import { FC } from "#/tests/utils/helper";

import { escapeField } from "@web-csv-toolbox/common";
import { SingleValueReadableStream } from "@web-csv-toolbox/shared";

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
            csv: new SingleValueReadableStream(csv),
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
            csv: new SingleValueReadableStream(new TextEncoder().encode(csv)),
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
              new SingleValueReadableStream(new TextEncoder().encode(csv)),
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
});
