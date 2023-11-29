import { assert, describe, it } from "vitest";
import { LexerTransformer } from "./LexerTransformer";
import { Token } from "./common/types";
import { Field, FieldDelimiter, RecordDelimiter } from "./common/constants";

describe("LexerTransformer(EOL=$title)", () => {
  async function transform(transformer: LexerTransformer, ...chunks: string[]) {
    const tokens: Token[] = [];
    await new ReadableStream({
      start(controller) {
        if (chunks.length === 0) {
          controller.close();
          return;
        }
        controller.enqueue(chunks.shift());
      },
      pull(controller) {
        if (chunks.length === 0) {
          controller.close();
          return;
        }
        controller.enqueue(chunks.shift());
      },
    })
      .pipeThrough(transformer)
      .pipeTo(
        new WritableStream({
          write(token) {
            tokens.push(token);
          },
        })
      );
    return tokens;
  }

  describe.each([
    { title: "LF", EOL: "\n" },
    { title: "CRLF", EOL: "\r\n" },
  ])("Context: $title", ({ EOL }) => {
    describe("single chunk", () => {
      it("should parse a single line", async () => {
        const chunk = "a,b,c";
        const expected = [
          { type: Field, value: "a" },
          { type: FieldDelimiter, value: "," },
          { type: Field, value: "b" },
          { type: FieldDelimiter, value: "," },
          { type: Field, value: "c" },
        ];
        const actual = await transform(new LexerTransformer(), chunk);
        assert.deepEqual(actual, expected);
      });

      it("should parse multiple lines", async () => {
        const chunk = `a,b,c${EOL}1,2,3`;
        const expected = [
          { type: Field, value: "a" },
          { type: FieldDelimiter, value: "," },
          { type: Field, value: "b" },
          { type: FieldDelimiter, value: "," },
          { type: Field, value: "c" },
          { type: RecordDelimiter, value: EOL },
          { type: Field, value: "1" },
          { type: FieldDelimiter, value: "," },
          { type: Field, value: "2" },
          { type: FieldDelimiter, value: "," },
          { type: Field, value: "3" },
        ];
        const actual = await transform(new LexerTransformer(), chunk);
        assert.deepEqual(actual, expected);
      });

      it("should parse quoted strings", async () => {
        const chunk = 'a,"b,c",d';
        const expected = [
          { type: Field, value: "a" },
          { type: FieldDelimiter, value: "," },
          { type: Field, value: "b,c" },
          { type: FieldDelimiter, value: "," },
          { type: Field, value: "d" },
        ];
        const actual = await transform(new LexerTransformer(), chunk);
        assert.deepEqual(actual, expected);
      });

      it("should parse quoted strings with newlines", async () => {
        const chunk = `a,"b${EOL}c",d`;
        const expected = [
          { type: Field, value: "a" },
          { type: FieldDelimiter, value: "," },
          { type: Field, value: `b${EOL}c` },
          { type: FieldDelimiter, value: "," },
          { type: Field, value: "d" },
        ];
        const actual = await transform(new LexerTransformer(), chunk);
        assert.deepEqual(actual, expected);
      });

      it("should parse quoted strings with escaped quotes", async () => {
        const chunk = 'a,"b""c",d';
        const expected = [
          { type: Field, value: "a" },
          { type: FieldDelimiter, value: "," },
          { type: Field, value: 'b"c' },
          { type: FieldDelimiter, value: "," },
          { type: Field, value: "d" },
        ];
        const actual = await transform(new LexerTransformer(), chunk);
        assert.deepEqual(actual, expected);
      });

      it("should parse quoted strings with newlines", async () => {
        const chunk = `a,"b${EOL}c",d`;
        const expected = [
          { type: Field, value: "a" },
          { type: FieldDelimiter, value: "," },
          { type: Field, value: `b${EOL}c` },
          { type: FieldDelimiter, value: "," },
          { type: Field, value: "d" },
        ];
        const actual = await transform(new LexerTransformer(), chunk);
        assert.deepEqual(actual, expected);
      });

      it("should parse quoted strings with escaped quotes and newlines", async () => {
        const chunk = `a,"b""${EOL}c",d`;
        const expected = [
          { type: Field, value: "a" },
          { type: FieldDelimiter, value: "," },
          { type: Field, value: `b"${EOL}c` },
          { type: FieldDelimiter, value: "," },
          { type: Field, value: "d" },
        ];
        const actual = await transform(new LexerTransformer(), chunk);
        assert.deepEqual(actual, expected);
      });
    });

    describe("multiple chunks", () => {
      describe("two chunks", () => {
        it("should parse a single line", async () => {
          const chunk1 = "a,b,";
          const chunk2 = "c";
          const expected = [
            { type: Field, value: "a" },
            { type: FieldDelimiter, value: "," },
            { type: Field, value: "b" },
            { type: FieldDelimiter, value: "," },
            { type: Field, value: "c" },
          ];
          const actual = await transform(
            new LexerTransformer(),
            chunk1,
            chunk2
          );
          assert.deepEqual(actual, expected);
        });

        it("should parse multiple lines", async () => {
          const chunk1 = "a,b,";
          const chunk2 = `c${EOL}1,2,3`;
          const expected = [
            { type: Field, value: "a" },
            { type: FieldDelimiter, value: "," },
            { type: Field, value: "b" },
            { type: FieldDelimiter, value: "," },
            { type: Field, value: "c" },
            { type: RecordDelimiter, value: EOL },
            { type: Field, value: "1" },
            { type: FieldDelimiter, value: "," },
            { type: Field, value: "2" },
            { type: FieldDelimiter, value: "," },
            { type: Field, value: "3" },
          ];
          const actual = await transform(
            new LexerTransformer(),
            chunk1,
            chunk2
          );
          assert.deepEqual(actual, expected);
        });

        it("should parse quoted strings", async () => {
          const chunk1 = 'a,"b,';
          const chunk2 = 'c",d';
          const expected = [
            { type: Field, value: "a" },
            { type: FieldDelimiter, value: "," },
            { type: Field, value: "b,c" },
            { type: FieldDelimiter, value: "," },
            { type: Field, value: "d" },
          ];
          const actual = await transform(
            new LexerTransformer(),
            chunk1,
            chunk2
          );
          assert.deepEqual(actual, expected);
        });

        it("should parse quoted strings with newlines", async () => {
          const chunk1 = `a,"b${EOL}c",`;
          const chunk2 = "d";
          const expected = [
            { type: Field, value: "a" },
            { type: FieldDelimiter, value: "," },
            { type: Field, value: `b${EOL}c` },
            { type: FieldDelimiter, value: "," },
            { type: Field, value: "d" },
          ];
          const actual = await transform(
            new LexerTransformer(),
            chunk1,
            chunk2
          );
          assert.deepEqual(actual, expected);
        });
      });

      describe("irregular chunks", () => {
        describe("empty chunk", () => {
          it("should parse a single line", async () => {
            const chunk1 = "a,b,";
            const chunk2 = "";
            const chunk3 = "c";
            const expected = [
              { type: Field, value: "a" },
              { type: FieldDelimiter, value: "," },
              { type: Field, value: "b" },
              { type: FieldDelimiter, value: "," },
              { type: Field, value: "c" },
            ];
            const actual = await transform(
              new LexerTransformer(),
              chunk1,
              chunk2,
              chunk3
            );
            assert.deepEqual(actual, expected);
          });

          it("should parse multiple lines", async () => {
            const chunk1 = "a,b,";
            const chunk2 = "";
            const chunk3 = `c${EOL}1,2,3`;
            const expected = [
              { type: Field, value: "a" },
              { type: FieldDelimiter, value: "," },
              { type: Field, value: "b" },
              { type: FieldDelimiter, value: "," },
              { type: Field, value: "c" },
              { type: RecordDelimiter, value: EOL },
              { type: Field, value: "1" },
              { type: FieldDelimiter, value: "," },
              { type: Field, value: "2" },
              { type: FieldDelimiter, value: "," },
              { type: Field, value: "3" },
            ];
            const actual = await transform(
              new LexerTransformer(),
              chunk1,
              chunk2,
              chunk3
            );
            assert.deepEqual(actual, expected);
          });

          it("should parse quoted strings", async () => {
            const chunk1 = 'a,"b,';
            const chunk2 = "";
            const chunk3 = 'c",d';
            const expected = [
              { type: Field, value: "a" },
              { type: FieldDelimiter, value: "," },
              { type: Field, value: "b,c" },
              { type: FieldDelimiter, value: "," },
              { type: Field, value: "d" },
            ];
            const actual = await transform(
              new LexerTransformer(),
              chunk1,
              chunk2,
              chunk3
            );
            assert.deepEqual(actual, expected);
          });
        });

        describe("chunk with no newline", () => {
          it("should parse a single line", async () => {
            const chunk1 = "a,b,";
            const chunk2 = "c";
            const chunk3 = "d,e,f";
            const expected = [
              { type: Field, value: "a" },
              { type: FieldDelimiter, value: "," },
              { type: Field, value: "b" },
              { type: FieldDelimiter, value: "," },
              { type: Field, value: "c" },
              { type: Field, value: "d" },
              { type: FieldDelimiter, value: "," },
              { type: Field, value: "e" },
              { type: FieldDelimiter, value: "," },
              { type: Field, value: "f" },
            ];
            const actual = await transform(
              new LexerTransformer(),
              chunk1,
              chunk2,
              chunk3
            );
            assert.deepEqual(actual, expected);
          });

          it("should parse multiple lines", async () => {
            const chunk1 = "a,b,";
            const chunk2 = "c";
            const chunk3 = `d,e,f${EOL}1,2,3`;
            const expected = [
              { type: Field, value: "a" },
              { type: FieldDelimiter, value: "," },
              { type: Field, value: "b" },
              { type: FieldDelimiter, value: "," },
              { type: Field, value: "c" },
              { type: Field, value: "d" },
              { type: FieldDelimiter, value: "," },
              { type: Field, value: "e" },
              { type: FieldDelimiter, value: "," },
              { type: Field, value: "f" },
              { type: RecordDelimiter, value: EOL },
              { type: Field, value: "1" },
              { type: FieldDelimiter, value: "," },
              { type: Field, value: "2" },
              { type: FieldDelimiter, value: "," },
              { type: Field, value: "3" },
            ];
            const actual = await transform(
              new LexerTransformer(),
              chunk1,
              chunk2,
              chunk3
            );
            assert.deepEqual(actual, expected);
          });

          it("should parse quoted strings", async () => {
            const chunk1 = 'a,"b,';
            const chunk2 = "c";
            const chunk3 = 'd,e",f';
            const expected = [
              { type: Field, value: "a" },
              { type: FieldDelimiter, value: "," },
              { type: Field, value: "b,cd,e" },
              { type: FieldDelimiter, value: "," },
              { type: Field, value: "f" },
            ];
            const actual = await transform(
              new LexerTransformer(),
              chunk1,
              chunk2,
              chunk3
            );
            assert.deepEqual(actual, expected);
          });

          it("should parse quoted strings with newlines", async () => {
            const chunk1 = `a,"b${EOL}c",`;
            const chunk2 = "d";
            const chunk3 = "e,f";
            const expected = [
              { type: Field, value: "a" },
              { type: FieldDelimiter, value: "," },
              { type: Field, value: `b${EOL}c` },
              { type: FieldDelimiter, value: "," },
              { type: Field, value: "d" },
              { type: Field, value: "e" },
              { type: FieldDelimiter, value: "," },
              { type: Field, value: "f" },
            ];
            const actual = await transform(
              new LexerTransformer(),
              chunk1,
              chunk2,
              chunk3
            );
            assert.deepEqual(actual, expected);
          });

          it("should parse quoted strings with escaped quotes", async () => {
            const chunk1 = 'a,"b""c",';
            const chunk2 = "d";
            const chunk3 = "e,f";
            const expected = [
              { type: Field, value: "a" },
              { type: FieldDelimiter, value: "," },
              { type: Field, value: 'b"c' },
              { type: FieldDelimiter, value: "," },
              { type: Field, value: "d" },
              { type: Field, value: "e" },
              { type: FieldDelimiter, value: "," },
              { type: Field, value: "f" },
            ];
            const actual = await transform(
              new LexerTransformer(),
              chunk1,
              chunk2,
              chunk3
            );
            assert.deepEqual(actual, expected);
          });
        });

        describe.each([
          { title: "LF", EOL: "\n" },
          { title: "CRLF", EOL: "\r\n" },
        ])("chunk with newline", () => {
          it("should parse a single line", async () => {
            const chunk1 = "a,b,";
            const chunk2 = `c${EOL}`;
            const chunk3 = "d,e,f";
            const expected = [
              { type: Field, value: "a" },
              { type: FieldDelimiter, value: "," },
              { type: Field, value: "b" },
              { type: FieldDelimiter, value: "," },
              { type: Field, value: "c" },
              { type: RecordDelimiter, value: EOL },
              { type: Field, value: "d" },
              { type: FieldDelimiter, value: "," },
              { type: Field, value: "e" },
              { type: FieldDelimiter, value: "," },
              { type: Field, value: "f" },
            ];
            const actual = await transform(
              new LexerTransformer(),
              chunk1,
              chunk2,
              chunk3
            );
            assert.deepEqual(actual, expected);
          });

          it("should parse multiple lines", async () => {
            const chunk1 = "a,b,";
            const chunk2 = `c${EOL}`;
            const chunk3 = `d,e,f${EOL}1,2,3`;
            const expected = [
              { type: Field, value: "a" },
              { type: FieldDelimiter, value: "," },
              { type: Field, value: "b" },
              { type: FieldDelimiter, value: "," },
              { type: Field, value: "c" },
              { type: RecordDelimiter, value: EOL },
              { type: Field, value: "d" },
              { type: FieldDelimiter, value: "," },
              { type: Field, value: "e" },
              { type: FieldDelimiter, value: "," },
              { type: Field, value: "f" },
              { type: RecordDelimiter, value: EOL },
              { type: Field, value: "1" },
              { type: FieldDelimiter, value: "," },
              { type: Field, value: "2" },
              { type: FieldDelimiter, value: "," },
              { type: Field, value: "3" },
            ];
            const actual = await transform(
              new LexerTransformer(),
              chunk1,
              chunk2,
              chunk3
            );
            assert.deepEqual(actual, expected);
          });
        });
      });
    });
  });
});
