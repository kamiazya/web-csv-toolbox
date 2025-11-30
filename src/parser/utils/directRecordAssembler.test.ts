import { describe, expect, test } from "vitest";
import { ParseError } from "@/core/errors.ts";
import {
  createAssemblerState,
  flushArrayRecord,
  flushObjectRecord,
  separatorsToArrayRecords,
  separatorsToObjectRecords,
  unescapeRange,
} from "./directRecordAssembler.ts";

describe("unescapeRange", () => {
  describe("unquoted fields", () => {
    test("should return simple unquoted field", () => {
      const csv = "hello,world";
      expect(unescapeRange(csv, 0, 5)).toBe("hello");
      expect(unescapeRange(csv, 6, 11)).toBe("world");
    });

    test("should handle empty field", () => {
      expect(unescapeRange("", 0, 0)).toBe("");
      expect(unescapeRange("a,,b", 2, 2)).toBe("");
    });

    test("should handle field with leading/trailing spaces", () => {
      const csv = " hello , world ";
      expect(unescapeRange(csv, 0, 7)).toBe(" hello ");
    });
  });

  describe("quoted fields", () => {
    test("should remove surrounding quotes", () => {
      const csv = '"hello"';
      expect(unescapeRange(csv, 0, 7)).toBe("hello");
    });

    test("should handle empty quoted field", () => {
      const csv = '""';
      expect(unescapeRange(csv, 0, 2)).toBe("");
    });

    test("should handle quoted field with spaces", () => {
      const csv = '" hello "';
      expect(unescapeRange(csv, 0, 9)).toBe(" hello ");
    });

    test("should unescape doubled quotes", () => {
      const csv = '"hello ""world"" test"';
      expect(unescapeRange(csv, 0, csv.length)).toBe('hello "world" test');
    });

    test("should handle field with only escaped quote", () => {
      const csv = '""""';
      expect(unescapeRange(csv, 0, 4)).toBe('"');
    });

    test("should handle multiple escaped quotes", () => {
      const csv = '"""""""';
      // Input: 7 quotes, remove surrounding: 5 inner quotes
      // Pairs: "" -> ", "" -> ", lone " at end
      expect(unescapeRange(csv, 0, 7)).toBe('"""');
    });
  });

  describe("CRLF handling", () => {
    test("should strip CR from end of unquoted field", () => {
      const csv = "hello\r";
      expect(unescapeRange(csv, 0, 6)).toBe("hello");
    });

    test("should strip CR from end of quoted field", () => {
      const csv = '"hello"\r';
      expect(unescapeRange(csv, 0, 8)).toBe("hello");
    });

    test("should preserve CR in middle of field", () => {
      const csv = '"hello\rworld"';
      expect(unescapeRange(csv, 0, csv.length)).toBe("hello\rworld");
    });
  });

  describe("custom quotation character", () => {
    test("should use custom quote character", () => {
      const csv = "'hello'";
      expect(unescapeRange(csv, 0, 7, "'")).toBe("hello");
    });

    test("should escape doubled custom quote", () => {
      const csv = "'hello ''world'' test'";
      expect(unescapeRange(csv, 0, csv.length, "'")).toBe("hello 'world' test");
    });
  });
});

describe("createAssemblerState", () => {
  test("should create state with explicit header", () => {
    const state = createAssemblerState({
      header: ["name", "age"] as const,
    });

    expect(state.headers).toEqual(["name", "age"]);
    expect(state.isHeaderRow).toBe(false);
    expect(state.rowNumber).toBe(1);
    expect(state.headerIncluded).toBe(false);
    expect(state.fieldStart).toBe(0);
    expect(state.currentRow).toEqual([]);
    expect(state.col).toBe(0);
  });

  test("should create state without header (infer mode)", () => {
    const state = createAssemblerState({});

    expect(state.headers).toEqual([]);
    expect(state.isHeaderRow).toBe(true);
    expect(state.rowNumber).toBe(1);
  });

  test("should create state with empty header array", () => {
    const state = createAssemblerState({
      header: [] as const,
    });

    expect(state.headers).toEqual([]);
    expect(state.isHeaderRow).toBe(true);
  });
});

describe("separatorsToObjectRecords", () => {
  /**
   * Helper to create packed separators.
   * @param entries - Array of [offset, isLF] pairs
   */
  function createSeparators(entries: [number, boolean][]): Uint32Array {
    const result = new Uint32Array(entries.length);
    for (let i = 0; i < entries.length; i++) {
      const [offset, isLF] = entries[i]!;
      result[i] = offset | (isLF ? 0x80000000 : 0);
    }
    return result;
  }

  test("should parse simple CSV with explicit header", () => {
    const csv = "Alice,30\n";
    const separators = createSeparators([
      [5, false], // ,
      [8, true], // \n
    ]);

    const config = { header: ["name", "age"] as const };
    const state = createAssemblerState(config);

    const records = [...separatorsToObjectRecords(separators, 2, csv, config, state)];

    expect(records).toEqual([{ name: "Alice", age: "30" }]);
  });

  test("should parse CSV and infer header", () => {
    // n a m e , a g e \n A  l  i  c  e  ,  3  0  \n
    // 0 1 2 3 4 5 6 7 8  9  10 11 12 13 14 15 16 17
    const csv = "name,age\nAlice,30\n";
    const separators = createSeparators([
      [4, false], // ,
      [8, true], // \n
      [14, false], // ,
      [17, true], // \n
    ]);

    const config = {};
    const state = createAssemblerState(config);

    const records = [...separatorsToObjectRecords(separators, 4, csv, config, state)];

    expect(records).toEqual([{ name: "Alice", age: "30" }]);
    expect(state.headers).toEqual(["name", "age"]);
  });

  test("should handle multiple rows", () => {
    const csv = "Alice,30\nBob,25\n";
    const separators = createSeparators([
      [5, false], // ,
      [8, true], // \n
      [12, false], // ,
      [15, true], // \n
    ]);

    const config = { header: ["name", "age"] as const };
    const state = createAssemblerState(config);

    const records = [...separatorsToObjectRecords(separators, 4, csv, config, state)];

    expect(records).toEqual([
      { name: "Alice", age: "30" },
      { name: "Bob", age: "25" },
    ]);
  });

  test("should handle quoted fields with commas", () => {
    const csv = '"Hello, World",42\n';
    const separators = createSeparators([
      [14, false], // ,
      [17, true], // \n
    ]);

    const config = { header: ["greeting", "number"] as const };
    const state = createAssemblerState(config);

    const records = [...separatorsToObjectRecords(separators, 2, csv, config, state)];

    expect(records).toEqual([{ greeting: "Hello, World", number: "42" }]);
  });

  describe("columnCountStrategy", () => {
    test("should pad missing fields with undefined (default)", () => {
      const csv = "Alice\n";
      const separators = createSeparators([[5, true]]);

      const config = {
        header: ["name", "age", "city"] as const,
        columnCountStrategy: "pad" as const,
      };
      const state = createAssemblerState(config);

      const records = [...separatorsToObjectRecords(separators, 1, csv, config, state)];

      expect(records).toEqual([{ name: "Alice", age: undefined, city: undefined }]);
    });

    test("should throw on strict strategy with wrong column count", () => {
      const csv = "Alice\n";
      const separators = createSeparators([[5, true]]);

      const config = {
        header: ["name", "age"] as const,
        columnCountStrategy: "strict" as const,
      };
      const state = createAssemblerState(config);

      expect(() => [
        ...separatorsToObjectRecords(separators, 1, csv, config, state),
      ]).toThrow(ParseError);
    });

    test("should truncate extra fields with truncate strategy", () => {
      const csv = "Alice,30,NY,extra\n";
      const separators = createSeparators([
        [5, false],
        [8, false],
        [11, false],
        [17, true],
      ]);

      const config = {
        header: ["name", "age"] as const,
        columnCountStrategy: "truncate" as const,
      };
      const state = createAssemblerState(config);

      const records = [...separatorsToObjectRecords(separators, 4, csv, config, state)];

      expect(records).toEqual([{ name: "Alice", age: "30" }]);
    });
  });

  describe("skipEmptyLines", () => {
    test("should skip empty lines when enabled", () => {
      const csv = "Alice,30\n\nBob,25\n";
      const separators = createSeparators([
        [5, false],
        [8, true],
        [9, true], // empty line
        [13, false],
        [16, true],
      ]);

      const config = {
        header: ["name", "age"] as const,
        skipEmptyLines: true,
      };
      const state = createAssemblerState(config);

      const records = [...separatorsToObjectRecords(separators, 5, csv, config, state)];

      expect(records).toEqual([
        { name: "Alice", age: "30" },
        { name: "Bob", age: "25" },
      ]);
    });
  });

  describe("error handling", () => {
    test("should throw on duplicate header fields", () => {
      // n a m e , n a m e \n A  l  i  c  e  ,  3  0  \n
      // 0 1 2 3 4 5 6 7 8 9  10 11 12 13 14 15 16 17 18
      const csv = "name,name\nAlice,30\n";
      const separators = createSeparators([
        [4, false], // ,
        [9, true], // \n
        [15, false], // ,
        [18, true], // \n
      ]);

      const config = {};
      const state = createAssemblerState(config);

      expect(() => [
        ...separatorsToObjectRecords(separators, 4, csv, config, state),
      ]).toThrow("The header must not contain duplicate fields");
    });

    test("should throw when maxFieldCount is exceeded", () => {
      const csv = "a,b,c,d,e\n";
      const separators = createSeparators([
        [1, false],
        [3, false],
        [5, false],
        [7, false],
        [9, true],
      ]);

      const config = { maxFieldCount: 3 };
      const state = createAssemblerState(config);

      expect(() => [
        ...separatorsToObjectRecords(separators, 5, csv, config, state),
      ]).toThrow(RangeError);
    });
  });
});

describe("separatorsToArrayRecords", () => {
  function createSeparators(entries: [number, boolean][]): Uint32Array {
    const result = new Uint32Array(entries.length);
    for (let i = 0; i < entries.length; i++) {
      const [offset, isLF] = entries[i]!;
      result[i] = offset | (isLF ? 0x80000000 : 0);
    }
    return result;
  }

  test("should parse simple CSV to arrays", () => {
    const csv = "Alice,30\n";
    const separators = createSeparators([
      [5, false],
      [8, true],
    ]);

    const config = { header: ["name", "age"] as const };
    const state = createAssemblerState(config);

    const records = [...separatorsToArrayRecords(separators, 2, csv, config, state)];

    expect(records).toEqual([["Alice", "30"]]);
  });

  test("should include header when requested with explicit header", () => {
    const csv = "Alice,30\n";
    const separators = createSeparators([
      [5, false],
      [8, true],
    ]);

    const config = {
      header: ["name", "age"] as const,
      includeHeader: true,
    };
    const state = createAssemblerState(config);

    const records = [...separatorsToArrayRecords(separators, 2, csv, config, state)];

    expect(records).toEqual([
      ["name", "age"],
      ["Alice", "30"],
    ]);
  });

  test("should include inferred header when requested", () => {
    // n a m e , a g e \n A  l  i  c  e  ,  3  0  \n
    // 0 1 2 3 4 5 6 7 8  9  10 11 12 13 14 15 16 17
    const csv = "name,age\nAlice,30\n";
    const separators = createSeparators([
      [4, false], // ,
      [8, true], // \n
      [14, false], // ,
      [17, true], // \n
    ]);

    const config = { includeHeader: true };
    const state = createAssemblerState(config);

    const records = [...separatorsToArrayRecords(separators, 4, csv, config, state)];

    expect(records).toEqual([
      ["name", "age"],
      ["Alice", "30"],
    ]);
  });

  describe("columnCountStrategy for arrays", () => {
    test("should keep as-is with 'keep' strategy (default)", () => {
      const csv = "Alice,30,NY\n";
      const separators = createSeparators([
        [5, false],
        [8, false],
        [11, true],
      ]);

      const config = {
        header: ["name", "age"] as const,
        columnCountStrategy: "keep" as const,
      };
      const state = createAssemblerState(config);

      const records = [...separatorsToArrayRecords(separators, 3, csv, config, state)];

      expect(records).toEqual([["Alice", "30", "NY"]]);
    });

    test("should pad to header length with 'pad' strategy", () => {
      const csv = "Alice\n";
      const separators = createSeparators([[5, true]]);

      const config = {
        header: ["name", "age", "city"] as const,
        columnCountStrategy: "pad" as const,
      };
      const state = createAssemblerState(config);

      const records = [...separatorsToArrayRecords(separators, 1, csv, config, state)];

      expect(records).toEqual([["Alice", "", ""]]);
    });

    test("should truncate with 'pad' strategy when exceeding header length", () => {
      const csv = "Alice,30,NY,extra\n";
      const separators = createSeparators([
        [5, false],
        [8, false],
        [11, false],
        [17, true],
      ]);

      const config = {
        header: ["name", "age"] as const,
        columnCountStrategy: "pad" as const,
      };
      const state = createAssemblerState(config);

      const records = [...separatorsToArrayRecords(separators, 4, csv, config, state)];

      expect(records).toEqual([["Alice", "30"]]);
    });
  });
});

describe("flushObjectRecord", () => {
  test("should flush remaining partial record", () => {
    const config = { header: ["name", "age"] as const };
    const state = createAssemblerState(config);
    state.currentRow = ["Alice", "30"];

    const records = [...flushObjectRecord(config, state)];

    expect(records).toEqual([{ name: "Alice", age: "30" }]);
    expect(state.currentRow).toEqual([]);
  });

  test("should not yield if no partial record", () => {
    const config = { header: ["name", "age"] as const };
    const state = createAssemblerState(config);

    const records = [...flushObjectRecord(config, state)];

    expect(records).toEqual([]);
  });

  test("should validate header on flush if still in header row", () => {
    const config = {};
    const state = createAssemblerState(config);
    state.headers = ["name", "name"]; // duplicate

    expect(() => [...flushObjectRecord(config, state)]).toThrow(
      "The header must not contain duplicate fields"
    );
  });
});

describe("flushArrayRecord", () => {
  test("should flush remaining partial record", () => {
    const config = { header: ["name", "age"] as const };
    const state = createAssemblerState(config);
    state.currentRow = ["Alice", "30"];

    const records = [...flushArrayRecord(config, state)];

    expect(records).toEqual([["Alice", "30"]]);
    expect(state.currentRow).toEqual([]);
  });

  test("should include header on flush if not yet included", () => {
    const config = {
      header: ["name", "age"] as const,
      includeHeader: true,
    };
    const state = createAssemblerState(config);
    // Header not yet included
    state.headerIncluded = false;

    const records = [...flushArrayRecord(config, state)];

    expect(records).toEqual([["name", "age"]]);
    expect(state.headerIncluded).toBe(true);
  });
});
