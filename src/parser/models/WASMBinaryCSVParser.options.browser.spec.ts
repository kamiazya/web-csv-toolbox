import { beforeAll, describe, expect, it } from "vitest";
import { loadWASM } from "../../wasm/loadWASM.ts";
import { WASMBinaryCSVParser } from "./WASMBinaryCSVParser.ts";

describe.skipIf(typeof window === "undefined")(
  "WASMBinaryCSVParser with options",
  () => {
    beforeAll(async () => {
      await loadWASM();
    });

    const encoder = new TextEncoder();

    it("should support custom quotation character", () => {
      const parser = new WASMBinaryCSVParser({ quotation: "'" });
      const data = encoder.encode("id,name\n1,'Alice Smith'\n2,'Bob Jones'");
      const records = parser.parse(data);

      expect(records).toEqual([
        { id: "1", name: "Alice Smith" },
        { id: "2", name: "Bob Jones" },
      ]);
    });

    it("should support custom header", () => {
      const parser = new WASMBinaryCSVParser({
        header: ["userId", "userName"] as const,
      });
      const data = encoder.encode("1,Alice\n2,Bob");
      const records = parser.parse(data);

      expect(records).toEqual([
        { userId: "1", userName: "Alice" },
        { userId: "2", userName: "Bob" },
      ]);
    });

    it("should support custom delimiter with custom quotation", () => {
      const parser = new WASMBinaryCSVParser({
        delimiter: "\t",
        quotation: "'",
      });
      const data = encoder.encode("id\tname\n1\t'Alice Smith'\n2\t'Bob Jones'");
      const records = parser.parse(data);

      expect(records).toEqual([
        { id: "1", name: "Alice Smith" },
        { id: "2", name: "Bob Jones" },
      ]);
    });

    it("should throw error when maxFieldCount is exceeded", () => {
      const parser = new WASMBinaryCSVParser({ maxFieldCount: 2 });
      const data = encoder.encode("a,b,c\n1,2,3");

      expect(() => {
        parser.parse(data);
      }).toThrow(/field count limit/i);
    });

    it("should handle streaming with custom options", () => {
      const parser = new WASMBinaryCSVParser({
        quotation: "'",
        header: ["id", "name"] as const,
      });

      const chunk1 = encoder.encode("1,'Alice");
      const records1 = parser.parse(chunk1, { stream: true });
      expect(records1).toEqual([]);

      const chunk2 = encoder.encode(" Smith'\n2,'Bob'");
      const records2 = parser.parse(chunk2, { stream: true });
      expect(records2).toEqual([{ id: "1", name: "Alice Smith" }]);

      const records3 = parser.parse();
      expect(records3).toEqual([{ id: "2", name: "Bob" }]);
    });

    it("should handle escaped quotes with custom quotation", () => {
      const parser = new WASMBinaryCSVParser({ quotation: "'" });
      const data = encoder.encode("id,text\n1,'He said ''Hello'''\n2,'Test'");
      const records = parser.parse(data);

      expect(records).toEqual([
        { id: "1", text: "He said 'Hello'" },
        { id: "2", text: "Test" },
      ]);
    });

    it("should work with all options combined", () => {
      const parser = new WASMBinaryCSVParser({
        delimiter: ";",
        quotation: "'",
        header: ["col1", "col2", "col3"] as const,
        maxFieldCount: 10,
      });

      const data = encoder.encode(
        "1;'value 1';'value 2'\n2;'value 3';'value 4'",
      );
      const records = parser.parse(data);

      expect(records).toEqual([
        { col1: "1", col2: "value 1", col3: "value 2" },
        { col1: "2", col2: "value 3", col3: "value 4" },
      ]);
    });

    it("should validate delimiter length", () => {
      expect(() => {
        new WASMBinaryCSVParser({ delimiter: ",," });
      }).toThrow(/delimiter must be a single character/i);
    });

    it("should validate quotation length", () => {
      expect(() => {
        new WASMBinaryCSVParser({ quotation: "''" });
      }).toThrow(/quotation must be a single character/i);
    });

    it("should validate maxFieldCount", () => {
      expect(() => {
        new WASMBinaryCSVParser({ maxFieldCount: 0 });
      }).toThrow(/maxfieldcount must be positive/i);

      expect(() => {
        new WASMBinaryCSVParser({ maxFieldCount: -1 });
      }).toThrow(/maxfieldcount must be positive/i);
    });
  },
);
