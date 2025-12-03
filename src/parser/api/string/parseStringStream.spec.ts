import fc from "fast-check";
import { describe, expect, it, test } from "vitest";
import { FC } from "@/__tests__/helper.ts";
import { parseStringStream } from "@/parser/api/string/parseStringStream.ts";
import { escapeField } from "@/utils/serialization/escapeField.ts";

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
          return {
            data,
            csv: new ReadableStream({
              start(controller) {
                controller.enqueue(csv);
                controller.close();
              },
            }),
            header,
          };
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

test("honors charset option for UTF-16 string streams", async () => {
  const stream = new ReadableStream<string>({
    start(controller) {
      controller.enqueue("名前,値\n日");
      controller.enqueue("本語,データ\n終わり,値2");
      controller.close();
    },
  });

  const rows: Array<Record<string, string>> = [];
  for await (const row of parseStringStream(stream, {
    charset: "utf-16",
    engine: { wasm: true },
  })) {
    rows.push(row as Record<string, string>);
  }

  expect(rows).toEqual([
    { 名前: "日本語", 値: "データ" },
    { 名前: "終わり", 値: "値2" },
  ]);
});

test("respects charset option for UTF-16 string streams", async () => {
  const stream = new ReadableStream<string>({
    start(controller) {
      controller.enqueue("名前,値\n日");
      controller.enqueue("本語,データ\n終わり,値2");
      controller.close();
    },
  });

  const rows: Array<Record<string, string>> = [];
  for await (const row of parseStringStream(stream, {
    charset: "utf-16",
    engine: { wasm: true },
  })) {
    rows.push(row as Record<string, string>);
  }

  expect(rows).toEqual([
    { 名前: "日本語", 値: "データ" },
    { 名前: "終わり", 値: "値2" },
  ]);
});

test("throws an error if invalid input", async () => {
  await expect(async () => {
    for await (const _ of parseStringStream(
      new ReadableStream({
        start(controller) {
          controller.enqueue('a\n"');
          controller.close();
        },
      }),
    )) {
      // Do nothing
    }
  }).rejects.toThrowErrorMatchingInlineSnapshot(
    `[ParseError: Unexpected EOF while parsing quoted field.]`,
  );
});
