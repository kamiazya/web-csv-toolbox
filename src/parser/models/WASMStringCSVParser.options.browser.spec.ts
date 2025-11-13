import { beforeAll, describe, expect, it } from "vitest";
import { loadWASM } from "../../wasm/loadWASM.ts";
import { WASMStringCSVParser } from "./WASMStringCSVParser.ts";

describe.skipIf(typeof window === "undefined")(
  "WASMStringCSVParser with options",
  () => {
    beforeAll(async () => {
      await loadWASM();
    });
    it("should support custom quotation character", () => {
      const parser = new WASMStringCSVParser({ quotation: "'" });
      const records = parser.parse("id,name\n1,'Alice Smith'\n2,'Bob Jones'");

      expect(records).toEqual([
        { id: "1", name: "Alice Smith" },
        { id: "2", name: "Bob Jones" },
      ]);
    });

    it("should support custom header", () => {
      const parser = new WASMStringCSVParser({
        header: ["userId", "userName"] as const,
      });
      const records = parser.parse("1,Alice\n2,Bob");

      expect(records).toEqual([
        { userId: "1", userName: "Alice" },
        { userId: "2", userName: "Bob" },
      ]);
    });

    it("should support custom delimiter with custom quotation", () => {
      const parser = new WASMStringCSVParser({
        delimiter: "\t",
        quotation: "'",
      });
      const records = parser.parse(
        "id\tname\n1\t'Alice Smith'\n2\t'Bob Jones'",
      );

      expect(records).toEqual([
        { id: "1", name: "Alice Smith" },
        { id: "2", name: "Bob Jones" },
      ]);
    });

    it("should throw error when maxFieldCount is exceeded", () => {
      const parser = new WASMStringCSVParser({ maxFieldCount: 2 });

      expect(() => {
        parser.parse("a,b,c\n1,2,3");
      }).toThrow(/field count limit/i);
    });

    it("should handle streaming with custom options", () => {
      const parser = new WASMStringCSVParser({
        quotation: "'",
        header: ["id", "name"] as const,
      });

      const records1 = parser.parse("1,'Alice", { stream: true });
      expect(records1).toEqual([]);

      const records2 = parser.parse(" Smith'\n2,'Bob'", { stream: true });
      expect(records2).toEqual([{ id: "1", name: "Alice Smith" }]);

      const records3 = parser.parse();
      expect(records3).toEqual([{ id: "2", name: "Bob" }]);
    });

    it("should handle escaped quotes with custom quotation", () => {
      const parser = new WASMStringCSVParser({ quotation: "'" });
      const records = parser.parse("id,text\n1,'He said ''Hello'''\n2,'Test'");

      expect(records).toEqual([
        { id: "1", text: "He said 'Hello'" },
        { id: "2", text: "Test" },
      ]);
    });

    it("should work with all options combined", () => {
      const parser = new WASMStringCSVParser({
        delimiter: ";",
        quotation: "'",
        header: ["col1", "col2", "col3"] as const,
        maxFieldCount: 10,
      });

      const records = parser.parse(
        "1;'value 1';'value 2'\n2;'value 3';'value 4'",
      );

      expect(records).toEqual([
        { col1: "1", col2: "value 1", col3: "value 2" },
        { col2: "value 3", col3: "value 4", col1: "2" },
      ]);
    });

    it("should validate delimiter length", () => {
      expect(() => {
        new WASMStringCSVParser({ delimiter: ",," });
      }).toThrow(/delimiter must be a single character/i);
    });

    it("should validate quotation length", () => {
      expect(() => {
        new WASMStringCSVParser({ quotation: "''" });
      }).toThrow(/quotation must be a single character/i);
    });

    it("should validate maxFieldCount", () => {
      expect(() => {
        new WASMStringCSVParser({ maxFieldCount: 0 });
      }).toThrow(/maxfieldcount must be positive/i);

      expect(() => {
        new WASMStringCSVParser({ maxFieldCount: -1 });
      }).toThrow(/maxfieldcount must be positive/i);
    });
  },
);
