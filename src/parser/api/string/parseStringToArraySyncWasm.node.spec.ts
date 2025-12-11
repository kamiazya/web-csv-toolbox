import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { FC } from "@/__tests__/helper.ts";
import { parseStringToArraySyncWasm } from "@/parser/api/string/parseStringToArraySyncWasm.main.node.ts";
import { escapeField } from "@/utils/serialization/escapeField.ts";
import {
  isSyncInitialized,
  loadWasmSync,
} from "@/wasm/loaders/loadWasmSync.node.ts";

// Try to initialize WASM, skip tests if SIMD is not supported
describe.skipIf(!isSyncInitialized() && (loadWasmSync(), !isSyncInitialized()))(
  "parseStringToArraySyncWasm",
  async () => {
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
            const result = parseStringToArraySyncWasm(csv);
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
        parseStringToArraySyncWasm(csv, { delimiter: "ab" }),
      ).toThrowErrorMatchingInlineSnapshot(
        `[RangeError: Invalid delimiter, must be a single character on Wasm.]`,
      );
    });

    it("should throw error when quotation is not double quote", async () => {
      const csv = "a,b,c\n1,2,3";

      expect(() =>
        parseStringToArraySyncWasm(csv, { quotation: "'" }),
      ).toThrowErrorMatchingInlineSnapshot(
        `[RangeError: Invalid quotation, must be double quote on Wasm.]`,
      );
    });
  },
);
