import { describe, expect, it } from "vitest";
import { ParserTransformar } from "./ParserTransformer.js";
import {
  CRLF,
  Field,
  FieldDelimiter,
  LF,
  RecordDelimiter,
  Token,
} from "./common/index.js";

describe("ParserTransformer", () => {
  async function transform(parser: ParserTransformar<any>, tokens: Token[]) {
    const rows: any[] = [];
    await new ReadableStream({
      start(controller) {
        if (tokens.length === 0) {
          controller.close();
          return;
        }
        controller.enqueue(tokens.shift());
      },
      pull(controller) {
        if (tokens.length === 0) {
          controller.close();
          return;
        }
        controller.enqueue(tokens.shift());
      },
    })
      .pipeThrough(parser)
      .pipeTo(
        new WritableStream({
          write(chunk) {
            rows.push(chunk);
          },
        }),
      );
    return rows;
  }

  describe.each([
    { title: "EOL=LF, EOF=true", EOL: LF, EOF: true },
    { title: "EOL=LF, EOF=false", EOL: LF, EOF: false },
    { title: "EOL=CRLF, EOF=true", EOL: CRLF, EOF: true },
    { title: "EOL=CRLF, EOF=false", EOL: CRLF, EOF: false },
  ])("Context: $title", ({ EOL, EOF }) => {
    it("should parse a CSV with headers by data", async () => {
      const parser = new ParserTransformar();
      const rows = await transform(parser, [
        { type: Field, value: "name" },
        { type: FieldDelimiter, value: "," },
        { type: Field, value: "age" },
        { type: RecordDelimiter, value: EOL },
        { type: Field, value: "Alice" },
        { type: FieldDelimiter, value: "," },
        { type: Field, value: "20" },
        { type: RecordDelimiter, value: EOL },
        { type: Field, value: "Bob" },
        { type: FieldDelimiter, value: "," },
        { type: Field, value: "25" },
        { type: RecordDelimiter, value: EOL },
        { type: Field, value: "Charlie" },
        { type: FieldDelimiter, value: "," },
        { type: Field, value: "30" },
        // @ts-ignore
        ...(EOF ? [{ type: RecordDelimiter, value: EOL }] : []),
      ]);

      expect(rows).toEqual([
        { name: "Alice", age: "20" },
        { name: "Bob", age: "25" },
        { name: "Charlie", age: "30" },
      ]);
    });

    it("should parse a CSV with headers by option", async () => {
      const parser = new ParserTransformar({
        header: ["name", "age"],
      });
      const rows = await transform(parser, [
        { type: Field, value: "Alice" },
        { type: FieldDelimiter, value: "," },
        { type: Field, value: "20" },
        { type: RecordDelimiter, value: EOL },
        { type: Field, value: "Bob" },
        { type: FieldDelimiter, value: "," },
        { type: Field, value: "25" },
        { type: RecordDelimiter, value: EOL },
        { type: Field, value: "Charlie" },
        { type: FieldDelimiter, value: "," },
        { type: Field, value: "30" },
        // @ts-ignore
        ...(EOF ? [{ type: RecordDelimiter, value: EOL }] : []),
      ]);

      expect(rows).toEqual([
        { name: "Alice", age: "20" },
        { name: "Bob", age: "25" },
        { name: "Charlie", age: "30" },
      ]);
    });

    it("should parse empty field", async () => {
      const parser = new ParserTransformar({
        header: ["name", "age"],
      });
      const rows = await transform(parser, [
        { type: RecordDelimiter, value: EOL },
        { type: Field, value: "Bob" },
        { type: FieldDelimiter, value: "," },
        { type: RecordDelimiter, value: EOL },
        { type: FieldDelimiter, value: "," },
        { type: Field, value: "30" },
        // @ts-ignore
        ...(EOF ? [{ type: RecordDelimiter, value: EOL }] : []),
      ]);

      expect(rows).toEqual([
        { name: undefined, age: undefined },
        { name: "Bob", age: undefined },
        { name: undefined, age: "30" },
      ]);
    });
  });
});
