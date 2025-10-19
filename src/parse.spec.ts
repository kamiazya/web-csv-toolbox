import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { FC } from "./__tests__/helper.ts";
import { escapeField } from "./escapeField.ts";
import { parse } from "./parse.ts";
import { SingleValueReadableStream } from "./utils/SingleValueReadableStream.ts";

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
    
async function toArray(csv: string | ReadableStream<string>): Promise<any[]>;
async function toArray(csv: Uint8Array | ArrayBuffer | ReadableStream<Uint8Array> | Response): Promise<any[]>;
async function toArray(
    csv: string | Uint8Array | ArrayBuffer | ReadableStream<any> | Response
): Promise<any[]> {
    const records = [];
    for await (const row of parse(csv as any)) {
        records.push(row);
    }
    return records;
}

describe('Line Ending Compatibility (CRLF vs LF)', () => {
  const expectedRecords = [
    { name: 'Alice', age: '42' },
    { name: 'Bob', age: '69' },
    { name: 'Charlie', age: '30' },
  ];
  
  it('should produce identical records for LF and CRLF line endings', async () => {
    const csvLF = 'name,age\nAlice,42\nBob,69\nCharlie,30';
    const recordsLF = await toArray(csvLF);

    const csvCRLF = 'name,age\r\nAlice,42\r\nBob,69\r\nCharlie,30';
    const recordsCRLF = await toArray(csvCRLF);

    expect(recordsLF).toEqual(expectedRecords);
    expect(recordsCRLF).toEqual(expectedRecords);
    expect(recordsLF).toEqual(recordsCRLF);
  });

  it('should handle mixed CRLF and LF line endings gracefully', async () => {
    const csvMixed = 'name,age\r\nAlice,42\nBob,69\r\nCharlie,30';
    
    const recordsMixed = await toArray(csvMixed);
    
    expect(recordsMixed).toEqual(expectedRecords);
  });

  it('should preserve line endings (LF and CRLF) inside quoted fields', async () => {
    const csv = `name,description\n"Alice","Line1\nLine2"\n"Bob","LineA\r\nLineB"`;
    
    const expected = [
      { name: 'Alice', description: 'Line1\nLine2' },
      { name: 'Bob', description: 'LineA\r\nLineB' },
    ];
    
    const records = await toArray(csv);
    
    expect(records).toEqual(expected);
  });

  it('should ignore a single trailing line ending (LF or CRLF) but handle double trailing EOL', async () => {
    const expected = [{ name: 'Alice', age: '42' }];
    const expectedWithEmpty = [...expected, { name: '', age: '' }];

    // Single trailing EOLs (should produce 1 record)
    const csvWithoutTrailing = 'name,age\nAlice,42';
    expect(await toArray(csvWithoutTrailing)).toEqual(expected);

    const csvWithTrailingLF = 'name,age\nAlice,42\n';
    expect(await toArray(csvWithTrailingLF)).toEqual(expected);

    const csvWithTrailingCRLF = 'name,age\nAlice,42\r\n';
    expect(await toArray(csvWithTrailingCRLF)).toEqual(expected);
    
    // 1. LF + LF (Your original passing test)
    const csvWithDoubleTrailingLF = 'name,age\nAlice,42\n\n';
    expect(await toArray(csvWithDoubleTrailingLF)).toEqual(expectedWithEmpty);
    
    // 2. CRLF + CRLF (New: All Windows)
    const csvWithDoubleTrailingCRLF = 'name,age\r\nAlice,42\r\n\r\n';
    expect(await toArray(csvWithDoubleTrailingCRLF)).toEqual(expectedWithEmpty);
    
    // 3. LF + CRLF (New: Mixed)
    const csvWithDoubleTrailingMixed1 = 'name,age\nAlice,42\n\r\n';
    expect(await toArray(csvWithDoubleTrailingMixed1)).toEqual(expectedWithEmpty);
    
    // 4. CRLF + LF (New: Mixed)
    const csvWithDoubleTrailingMixed2 = 'name,age\r\nAlice,42\r\n\n';
    expect(await toArray(csvWithDoubleTrailingMixed2)).toEqual(expectedWithEmpty);
  });
});
});
