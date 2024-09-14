import fc from "fast-check";
import { describe, expect, it } from "vitest";

import { FC } from "#/tests/utils/helper";

import { escapeField } from "@web-csv-toolbox/common";
import { parseString } from "./parseString";

describe("parseString function", () => {
  it("should parse CSV", () =>
    fc.assert(
      fc.asyncProperty(
        fc.gen().map((g) => {
          const header = g(FC.header);
          const EOL = g(FC.eol);
          const csvData = g(FC.csvData, {
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
          return { data, csv, header };
        }),
        async ({ data, csv }) => {
          let i = 0;
          for await (const record of parseString(csv)) {
            expect(data[i++]).toEqual(record);
          }
        },
      ),
    ));

  it("should throw an error if the CSV is invalid", () => {
    expect(async () => {
      for await (const _ of parseString('a\na"')) {
        // Do nothing.
      }
    }).rejects.toThrowErrorMatchingInlineSnapshot(
      // biome-ignore lint/style/noUnusedTemplateLiteral: This is a snapshot
      `[ParseError: Unexpected EOF while parsing quoted field.]`,
    );
  });

  it("should throw an error if options is invalid", () => {
    expect(async () => {
      for await (const _ of parseString("", { delimiter: "" as string })) {
        // Do nothing.
      }
    }).rejects.toThrowErrorMatchingInlineSnapshot(
      // biome-ignore lint/style/noUnusedTemplateLiteral: This is a snapshot
      `[RangeError: delimiter must not be empty]`,
    );
  });
});

describe("parseString.toArray function", () => {
  it("should parse CSV", () =>
    fc.assert(
      fc.asyncProperty(
        fc.gen().map((g) => {
          const header = g(FC.header);
          const EOL = g(FC.eol);
          const csvData = g(FC.csvData, {
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
          return { data, csv, header };
        }),
        async ({ data, csv }) => {
          let i = 0;
          for (const record of await parseString.toArray(csv)) {
            expect(data[i++]).toEqual(record);
          }
        },
      ),
    ));
});

describe("parseString.toArraySync function", () => {
  it("should parse CSV", () =>
    fc.assert(
      fc.asyncProperty(
        fc.gen().map((g) => {
          const header = g(FC.header);
          const EOL = g(FC.eol);
          const csvData = g(FC.csvData, {
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
          return { data, csv, header };
        }),
        async ({ data, csv }) => {
          let i = 0;
          for (const record of parseString.toArraySync(csv)) {
            expect(data[i++]).toEqual(record);
          }
        },
      ),
    ));
});

describe("parseString.toIterableIterator function", () => {
  it("should parse CSV", () =>
    fc.assert(
      fc.asyncProperty(
        fc.gen().map((g) => {
          const header = g(FC.header);
          const EOL = g(FC.eol);
          const csvData = g(FC.csvData, {
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
          return { data, csv, header };
        }),
        async ({ data, csv }) => {
          let i = 0;
          for (const record of parseString.toIterableIterator(csv)) {
            expect(data[i++]).toEqual(record);
          }
        },
      ),
    ));
});

describe("parseString.toStream function", () => {
  it("should parse CSV", () =>
    fc.assert(
      fc.asyncProperty(
        fc.gen().map((g) => {
          const header = g(FC.header);
          const EOL = g(FC.eol);
          const csvData = g(FC.csvData, {
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
          return { data, csv, header };
        }),
        async ({ data, csv }) => {
          let i = 0;
          await parseString.toStream(csv).pipeTo(
            new WritableStream({
              write(record) {
                expect(record).toEqual(data[i++]);
              },
            }),
          );
        },
      ),
    ));
});
