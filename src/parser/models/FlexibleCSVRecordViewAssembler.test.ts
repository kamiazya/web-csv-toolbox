import { describe, expect, test } from "vitest";
import { FlexibleStringCSVLexer } from "@/parser/api/model/createStringCSVLexer.ts";
import { FlexibleCSVRecordViewAssembler } from "@/parser/models/FlexibleCSVRecordViewAssembler.ts";

describe("FlexibleCSVRecordViewAssembler", () => {
  test("should expose both tuple indices and header keys", () => {
    const lexer = new FlexibleStringCSVLexer();
    const assembler = new FlexibleCSVRecordViewAssembler({
      header: ["name", "age"] as const,
    });
    const csv = "Alice,30\r\nBob,25\r\n";
    const records = [...assembler.assemble(lexer.lex(csv))];
    expect(records).toHaveLength(2);
    expect(Array.isArray(records[0])).toBe(true);
    expect(records[0]![0]).toBe("Alice");
    expect(records[0]!.name).toBe("Alice");
    expect(records[0]!.age).toBe("30");
    expect(Object.keys(records[0]!)).toEqual(["0", "1", "name", "age"]);
  });

  test("should enforce strict column counts", () => {
    const lexer = new FlexibleStringCSVLexer();
    const assembler = new FlexibleCSVRecordViewAssembler({
      header: ["name", "age"] as const,
      columnCountStrategy: "strict",
    });
    const csv = "Alice,30\r\n";
    const records = [...assembler.assemble(lexer.lex(csv))];
    expect(records).toHaveLength(1);
    expect(records[0]!.name).toBe("Alice");
  });

  test("should throw for short row when strict strategy is enabled", () => {
    const lexer = new FlexibleStringCSVLexer();
    const assembler = new FlexibleCSVRecordViewAssembler({
      header: ["name", "age"] as const,
      columnCountStrategy: "strict",
    });
    const csv = "Alice\r\n";
    expect(() => [...assembler.assemble(lexer.lex(csv))]).toThrow(
      /Expected 2 columns/,
    );
  });

  test("should reject keep columnCountStrategy", () => {
    expect(() => {
      new FlexibleCSVRecordViewAssembler({
        header: ["name", "age"] as const,
        columnCountStrategy: "keep",
      });
    }).toThrow(/columnCountStrategy 'keep' is not allowed for object format/);
  });

  test("should reject explicit headerless configuration", () => {
    expect(() => {
      new FlexibleCSVRecordViewAssembler({
        header: [] as unknown as [],
      } as any);
    }).toThrow(/Headerless mode \(header: \[\]\) is not supported/);
  });

  test("pads tuple indices when fill strategy encounters short rows", () => {
    const lexer = new FlexibleStringCSVLexer();
    const assembler = new FlexibleCSVRecordViewAssembler({
      header: ["a", "b", "c"] as const,
      columnCountStrategy: "fill",
    });
    const csv = "x\r\n";
    const [record] = [...assembler.assemble(lexer.lex(csv))];
    expect(record).toBeDefined();
    expect(record!.length).toBe(3);
    expect(record![0]).toBe("x");
    expect(record![1]).toBe("");
    expect(record![2]).toBe("");
    expect(record!.c).toBe("");
  });
});
