import fc from "fast-check";
import { describe, expect, it, test } from "vitest";
import { FC } from "./__tests__/helper.ts";
import type { ExecutionStrategy } from "./common/types.ts";
import { escapeField } from "./escapeField.ts";
import { parseStringStream } from "./parseStringStream.ts";
import { SingleValueReadableStream } from "./utils/SingleValueReadableStream.ts";

describe("parseStringStream function", () => {
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
          return { data, csv: new SingleValueReadableStream(csv), header };
        }),
        async ({ data, csv }) => {
          let i = 0;
          for await (const row of parseStringStream(csv)) {
            expect(data[i++]).toEqual(row);
          }
        },
      ),
    ));
});

test("throws an error if invalid input", async () => {
  await expect(async () => {
    for await (const _ of parseStringStream(
      new SingleValueReadableStream('a\n"'),
    )) {
      // Do nothing
    }
  }).rejects.toThrowErrorMatchingInlineSnapshot(
    // biome-ignore lint/style/noUnusedTemplateLiteral: This is a snapshot
    `[ParseError: Unexpected EOF while parsing quoted field.]`,
  );
});
