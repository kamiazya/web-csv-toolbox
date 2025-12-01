import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { FC } from "@/__tests__/helper.ts";
import { parseBlob } from "@/parser/api/file/parseBlob.ts";
import { escapeField } from "@/utils/serialization/escapeField.ts";

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
            expect(data[i++]).toEqual(row);
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
      expect(row).toEqual(expected[i++]);
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
      expect(row).toEqual(expected[i++]);
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
      expect(row).toEqual(expected[i++]);
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
    expect(records).toEqual(expected);
  });

  describe("source handling", () => {
    it("should not automatically set source from File.name", async () => {
      // Create CSV with field count exceeding limit
      const headers = Array.from({ length: 10 }, (_, i) => `field${i}`).join(
        ",",
      );
      const file = new File([headers], "data.csv", { type: "text/csv" });

      try {
        for await (const _ of parseBlob(file, { maxFieldCount: 5 })) {
          // Should throw before reaching here
        }
        expect.unreachable();
      } catch (error) {
        expect(error).toBeInstanceOf(RangeError);
        // Should NOT include filename in error message
        expect((error as RangeError).message).not.toContain("data.csv");
        expect((error as RangeError).message).not.toContain("in");
      }
    });

    it("should respect manually provided source option", async () => {
      const headers = Array.from({ length: 10 }, (_, i) => `field${i}`).join(
        ",",
      );
      const blob = new Blob([headers], { type: "text/csv" });

      try {
        for await (const _ of parseBlob(blob, {
          maxFieldCount: 5,
          source: "custom-source.csv",
        })) {
          // Should throw before reaching here
        }
        expect.unreachable();
      } catch (error) {
        expect(error).toBeInstanceOf(RangeError);
        // Should include manually provided source
        expect((error as RangeError).message).toContain(
          'in "custom-source.csv"',
        );
      }
    });

    it("should allow manual source even with File objects", async () => {
      const headers = Array.from({ length: 10 }, (_, i) => `field${i}`).join(
        ",",
      );
      const file = new File([headers], "actual-filename.csv", {
        type: "text/csv",
      });

      try {
        for await (const _ of parseBlob(file, {
          maxFieldCount: 5,
          source: "custom-source.csv",
        })) {
          // Should throw before reaching here
        }
        expect.unreachable();
      } catch (error) {
        expect(error).toBeInstanceOf(RangeError);
        // Should include manually provided source, not file.name
        expect((error as RangeError).message).toContain(
          'in "custom-source.csv"',
        );
        expect((error as RangeError).message).not.toContain(
          "actual-filename.csv",
        );
      }
    });

    it("should handle Blob without source gracefully", async () => {
      const headers = Array.from({ length: 10 }, (_, i) => `field${i}`).join(
        ",",
      );
      const blob = new Blob([headers], { type: "text/csv" });

      try {
        for await (const _ of parseBlob(blob, { maxFieldCount: 5 })) {
          // Should throw before reaching here
        }
        expect.unreachable();
      } catch (error) {
        expect(error).toBeInstanceOf(RangeError);
        const message = (error as RangeError).message;
        // Should have proper error message without source
        expect(message).toContain("Field count");
        expect(message).toContain("exceeded maximum allowed count");
        expect(message).not.toContain("in");
      }
    });
  });
});
