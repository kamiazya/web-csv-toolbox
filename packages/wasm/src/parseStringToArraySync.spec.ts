import { fc } from "@fast-check/vitest";
import { beforeAll, describe, expect, it } from "vitest";

import { escapeField } from "@web-csv-toolbox/common";
import { loadWASM } from "@web-csv-toolbox/wasm";

import { FC } from "#/tests/utils/helper";

import { parseStringToArraySync } from "./wasm";

describe("parseStringToArraySync", async () => {
  beforeAll(async () => {
    await loadWASM();
  });

  it("should parse CSV string to record of arrays", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.gen().map((g) => {
          const header = g(FC.header, {
            fieldConstraints: {
              kindExcludes: ["string16bits"],
            },
          });
          const EOL = g(FC.eol);
          const csvData = g(FC.csvData, {
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
          return { data, csv, header };
        }),
        async ({ data, csv }) => {
          let i = 0;
          const result = parseStringToArraySync(csv);
          expect(result.length).toEqual(data.length);
          for (const record of result) {
            expect(data[i++]).toEqual(record);
          }
        },
      ),
    );
  });

  it("should throw error when delimiter is not a single character", async () => {
    const csv = "a,b,c\n1,2,3";

    expect(() =>
      parseStringToArraySync(csv, { delimiter: "ab" }),
    ).toThrowErrorMatchingInlineSnapshot(
      // biome-ignore lint/style/noUnusedTemplateLiteral: This is a snapshot
      `[RangeError: delimiter must be a single character]`,
    );
  });

  it("should throw error when quotation is not double quote", async () => {
    const csv = "a,b,c\n1,2,3";

    expect(() =>
      parseStringToArraySync(csv, { quotation: "'" }),
    ).toThrowErrorMatchingInlineSnapshot(
      // biome-ignore lint/style/noUnusedTemplateLiteral: This is a snapshot
      `[RangeError: Invalid quotation, must be double quote on WASM.]`,
    );
  });
});
