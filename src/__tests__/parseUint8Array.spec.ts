import { fc } from "@fast-check/vitest";
import { describe, expect, it } from "vitest";
import { escapeField } from "../internal/escapeField.js";
import { parseUint8Array } from "../parseUint8Array.js";
import { FC } from "./helper";

describe("parseUint8Array function", () => {
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
            csv: new TextEncoder().encode(csv),
          };
        }),
        async ({ data, csv }) => {
          let i = 0;
          for await (const row of parseUint8Array(csv)) {
            expect(data[i++]).toStrictEqual(row);
          }
        },
      ),
    ));
});
