import { fc } from "@fast-check/vitest";
import { describe, expect, it } from "vitest";
import { escapeField } from "../internal/escapeField.js";
import { parse } from "../parse.js";
import { FC } from "./helper.js";

describe("parse.toArray function", () => {
  it("should parse CSV", () =>
    fc.assert(
      fc.asyncProperty(
        fc.gen().map((g) => {
          const header = g(FC.header);
          const EOL = g(FC.eol);
          const EOF = g(fc.boolean);
          const csvData = g(FC.csvData, {
            columnsConstraints: {
              minLength: header.length,
              maxLength: header.length,
            },
          });
          const csv = [
            header.map((v) => escapeField(v, { quate: true })).join(","),
            ...csvData.map((row) =>
              row.map((v) => escapeField(v, { quate: true })).join(","),
            ),
            ...(EOF ? [""] : []),
            "",
          ].join(EOL);
          const data =
            csvData.length >= 1
              ? csvData.map((row) =>
                  Object.fromEntries(row.map((v, i) => [header[i], v])),
                )
              : [];
          return { data, csv };
        }),
        async ({ data, csv }) => {
          const actual = await parse.toArray(csv);
          expect(actual).toEqual(data);
        },
      ),
      {
        examples: [
          [{ csv: "a,b,c\n1,2,3", data: [{ a: "1", b: "2", c: "3" }] }],
          [{ csv: "a,b,c\n1,,3", data: [{ a: "1", c: "3" }] }],
          [{ csv: "a,b,c\n1,2,3\r", data: [{ a: "1", b: "2", c: "3" }] }],
        ],
      },
    ));
});
