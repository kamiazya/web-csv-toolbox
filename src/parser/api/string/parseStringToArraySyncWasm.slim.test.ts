import type { Mock } from "vitest";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock dependencies
vi.mock("web-csv-toolbox-wasm", () => ({
  parseStringToArraySync: vi.fn(),
}));

vi.mock("@/wasm/loaders/wasmState.ts", () => ({
  isInitialized: vi.fn(),
}));

vi.mock("./parseStringToArraySyncWasm.shared.ts", async () => {
  const actual = await vi.importActual<
    typeof import("./parseStringToArraySyncWasm.shared.ts")
  >("./parseStringToArraySyncWasm.shared.ts");
  const { fromFlatParseResult } = await import(
    "@/parser/utils/flatToObjects.ts"
  );
  return {
    ...actual,
    parseWithWasm: vi.fn(
      (csv, delim, buffer, maxFieldCount, source, wasmFn) => {
        const flatResult = wasmFn(csv, delim, buffer, maxFieldCount, source);
        return fromFlatParseResult(flatResult);
      },
    ),
  };
});

import { parseStringToArraySync as wasmParseStringToArraySync } from "web-csv-toolbox-wasm";
import { isInitialized } from "@/wasm/loaders/wasmState.ts";
import { parseWithWasm } from "./parseStringToArraySyncWasm.shared.ts";
import { parseStringToArraySyncWasm } from "./parseStringToArraySyncWasm.slim.ts";

describe("parseStringToArraySyncWasm.slim - manual initialization", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("manual initialization requirement", () => {
    it("should throw error when Wasm not initialized", () => {
      (isInitialized as Mock).mockReturnValue(false);

      expect(() => parseStringToArraySyncWasm("a,b\n1,2")).toThrow(RangeError);
      expect(() => parseStringToArraySyncWasm("a,b\n1,2")).toThrow(
        /Wasm module is not initialized/,
      );
    });

    it("should include helpful message about calling loadWasm()", () => {
      (isInitialized as Mock).mockReturnValue(false);

      expect(() => parseStringToArraySyncWasm("")).toThrow(
        /Please call loadWasm\(\) before using parseStringToArraySyncWasm\(\)/,
      );
    });

    it("should mention slim entry in error message", () => {
      (isInitialized as Mock).mockReturnValue(false);

      expect(() => parseStringToArraySyncWasm("")).toThrow(/slim entry/);
    });

    it("should not call Wasm parser when not initialized", () => {
      (isInitialized as Mock).mockReturnValue(false);

      try {
        parseStringToArraySyncWasm("a,b\n1,2");
      } catch {
        // Error expected
      }

      expect(wasmParseStringToArraySync).not.toHaveBeenCalled();
    });

    it("should check initialization before attempting to parse", () => {
      (isInitialized as Mock).mockReturnValue(false);

      try {
        parseStringToArraySyncWasm("");
      } catch {
        // Error expected
      }

      expect(isInitialized).toHaveBeenCalled();
    });
  });

  describe("successful parsing when initialized", () => {
    it("should parse CSV correctly when initialized", () => {
      (isInitialized as Mock).mockReturnValue(true);
      (wasmParseStringToArraySync as Mock).mockReturnValue({
        headers: ["name", "age"],
        fieldData: ["Alice", "30"],
        actualFieldCounts: null,
        recordCount: 1,
        fieldCount: 2,
      });

      const csv = "name,age\nAlice,30";
      const result = parseStringToArraySyncWasm(csv);

      expect(result).toEqual([{ name: "Alice", age: "30" }]);
      expect(isInitialized).toHaveBeenCalled();
    });

    it("should parse CSV with custom delimiter when initialized", () => {
      (isInitialized as Mock).mockReturnValue(true);
      (wasmParseStringToArraySync as Mock).mockReturnValue({
        headers: ["a", "b"],
        fieldData: ["1", "2"],
        actualFieldCounts: null,
        recordCount: 1,
        fieldCount: 2,
      });

      const csv = "a\tb\n1\t2";
      const result = parseStringToArraySyncWasm(csv, { delimiter: "\t" });

      expect(result).toEqual([{ a: "1", b: "2" }]);
    });

    it("should parse CSV with header row when initialized", () => {
      (isInitialized as Mock).mockReturnValue(true);
      (wasmParseStringToArraySync as Mock).mockReturnValue({
        headers: ["x", "y"],
        fieldData: ["1", "2"],
        actualFieldCounts: null,
        recordCount: 1,
        fieldCount: 2,
      });

      const csv = "x,y\n1,2";
      const result = parseStringToArraySyncWasm(csv);

      expect(result).toEqual([{ x: "1", y: "2" }]);
    });

    it("should work for multiple calls when initialized", () => {
      (isInitialized as Mock).mockReturnValue(true);
      (wasmParseStringToArraySync as Mock).mockReturnValue({
        headers: ["a"],
        fieldData: ["1"],
        actualFieldCounts: null,
        recordCount: 1,
        fieldCount: 1,
      });

      // Multiple calls should all succeed
      parseStringToArraySyncWasm("a\n1");
      parseStringToArraySyncWasm("a\n2");
      parseStringToArraySyncWasm("a\n3");

      expect(wasmParseStringToArraySync).toHaveBeenCalledTimes(3);
    });
  });

  describe("validation before initialization check", () => {
    it("should validate delimiter before checking initialization", () => {
      (isInitialized as Mock).mockReturnValue(true);

      // Invalid delimiter should throw before checking initialization
      expect(() =>
        parseStringToArraySyncWasm("a,b", { delimiter: ",," as any }),
      ).toThrow(RangeError);
      expect(() =>
        parseStringToArraySyncWasm("a,b", { delimiter: ",," as any }),
      ).toThrow(/Invalid delimiter/);
    });

    it("should validate quotation before checking initialization", () => {
      (isInitialized as Mock).mockReturnValue(true);

      // Invalid quotation should throw before checking initialization
      expect(() =>
        parseStringToArraySyncWasm("a,b", { quotation: "'" as any }),
      ).toThrow(RangeError);
      expect(() =>
        parseStringToArraySyncWasm("a,b", { quotation: "'" as any }),
      ).toThrow(/Invalid quotation/);
    });

    it("should prioritize validation errors over initialization errors", () => {
      (isInitialized as Mock).mockReturnValue(false);

      // When both validation and initialization fail, validation error should be thrown
      expect(() =>
        parseStringToArraySyncWasm("", { delimiter: "" as any }),
      ).toThrow(/Invalid delimiter/);
      expect(() =>
        parseStringToArraySyncWasm("", { delimiter: "" as any }),
      ).not.toThrow(/Wasm module is not initialized/);
    });
  });

  describe("integration with shared utilities", () => {
    it("should parse CSV with header from first row", () => {
      (isInitialized as Mock).mockReturnValue(true);
      (wasmParseStringToArraySync as Mock).mockReturnValue({
        headers: ["col1", "col2"],
        fieldData: ["1", "2"],
        actualFieldCounts: null,
        recordCount: 1,
        fieldCount: 2,
      });

      const csv = "col1,col2\n1,2";
      parseStringToArraySyncWasm(csv);

      // parseWithWasm should receive the CSV as-is
      expect(parseWithWasm).toHaveBeenCalledWith(
        csv,
        44, // delimiter code for ","
        10485760, // default maxBufferSize
        1000, // default maxFieldCount
        "", // default source
        wasmParseStringToArraySync,
      );
    });

    it("should pass validated options to parseWithWasm", () => {
      (isInitialized as Mock).mockReturnValue(true);
      (wasmParseStringToArraySync as Mock).mockReturnValue({
        headers: [],
        fieldData: [],
        actualFieldCounts: null,
        recordCount: 0,
        fieldCount: 0,
      });

      const csv = "a;b\n1;2";
      parseStringToArraySyncWasm(csv, {
        delimiter: ";",
        maxBufferSize: 2048,
        source: "test.csv",
      });

      expect(parseWithWasm).toHaveBeenCalledWith(
        csv,
        59, // delimiter code for ";"
        2048,
        1000, // default maxFieldCount
        "test.csv",
        wasmParseStringToArraySync,
      );
    });
  });

  describe("comparison with main version", () => {
    it("should NOT auto-initialize (unlike main version)", () => {
      (isInitialized as Mock).mockReturnValue(false);

      // Slim entry should NOT auto-initialize, should throw error instead
      expect(() => parseStringToArraySyncWasm("")).toThrow(
        /Wasm module is not initialized/,
      );

      // Should not have attempted any initialization
      expect(wasmParseStringToArraySync).not.toHaveBeenCalled();
    });

    it("should require explicit loadWasm() call", () => {
      (isInitialized as Mock).mockReturnValue(false);

      // Slim entry characteristics:
      // - No auto-initialization
      // - Requires explicit loadWasm() call
      // - Smaller main bundle (no inlined Wasm)
      // - Throws error if not initialized

      expect(() => parseStringToArraySyncWasm("")).toThrow(
        /Please call loadWasm\(\)/,
      );
    });

    it("should provide smaller bundle at cost of convenience", () => {
      // Slim entry trade-offs:
      // - Smaller bundle (no inlined Wasm)
      // - Requires manual initialization
      // - Better for bundle size optimization

      (isInitialized as Mock).mockReturnValue(false);

      // Cannot use immediately without manual loadWasm call
      expect(() => parseStringToArraySyncWasm("")).toThrow();
    });
  });

  describe("recommended usage pattern", () => {
    it("should work with manual initialization pattern (required)", () => {
      // Required pattern for slim entry:
      // 1. User must call loadWasm() first
      // 2. Then can call parseStringToArraySyncWasm()

      (isInitialized as Mock).mockReturnValue(true); // Simulates loadWasm() was called
      (wasmParseStringToArraySync as Mock).mockReturnValue({
        headers: ["a", "b"],
        fieldData: ["1", "2"],
        actualFieldCounts: null,
        recordCount: 1,
        fieldCount: 2,
      });

      // Now parsing should work
      const result = parseStringToArraySyncWasm("a,b\n1,2");

      expect(result).toEqual([{ a: "1", b: "2" }]);
    });

    it("should fail gracefully with clear error when not initialized", () => {
      // If user forgets to call loadWasm(), should get clear error

      (isInitialized as Mock).mockReturnValue(false);

      expect(() => parseStringToArraySyncWasm("a,b\n1,2")).toThrow(
        /Wasm module is not initialized.*Please call loadWasm\(\)/,
      );
    });
  });

  describe("edge cases when initialized", () => {
    it("should handle empty CSV when initialized", () => {
      (isInitialized as Mock).mockReturnValue(true);
      (wasmParseStringToArraySync as Mock).mockReturnValue({
        headers: [],
        fieldData: [],
        actualFieldCounts: null,
        recordCount: 0,
        fieldCount: 0,
      });

      const result = parseStringToArraySyncWasm("");

      expect(result).toEqual([]);
    });

    it("should handle large CSV when initialized", () => {
      (isInitialized as Mock).mockReturnValue(true);
      const largeHeaders = ["id", "value"];
      const largeFieldData: string[] = [];
      for (let i = 0; i < 1000; i++) {
        largeFieldData.push(String(i), String(i * 2));
      }
      (wasmParseStringToArraySync as Mock).mockReturnValue({
        headers: largeHeaders,
        fieldData: largeFieldData,
        actualFieldCounts: null,
        recordCount: 1000,
        fieldCount: 2,
      });

      const csv =
        "id,value\n" +
        Array.from({ length: 1000 }, (_, i) => `${i},${i * 2}`).join("\n");
      const result = parseStringToArraySyncWasm(csv);

      expect(result).toHaveLength(1000);
    });

    it("should handle special characters when initialized", () => {
      (isInitialized as Mock).mockReturnValue(true);
      (wasmParseStringToArraySync as Mock).mockReturnValue({
        headers: ["name", "desc"],
        fieldData: ["O'Reilly", 'Quote: "test"'],
        actualFieldCounts: null,
        recordCount: 1,
        fieldCount: 2,
      });

      const csv = 'name,desc\n"O\'Reilly","Quote: ""test"""';
      const result = parseStringToArraySyncWasm(csv);

      expect(result).toEqual([{ name: "O'Reilly", desc: 'Quote: "test"' }]);
    });
  });

  describe("state consistency", () => {
    it("should consistently check initialization state", () => {
      // If state changes during execution, behavior should match current state

      // First call: not initialized
      (isInitialized as Mock).mockReturnValueOnce(false);
      expect(() => parseStringToArraySyncWasm("")).toThrow(
        /Wasm module is not initialized/,
      );

      // Second call: now initialized (loadWasm was called in between)
      (isInitialized as Mock).mockReturnValueOnce(true);
      (wasmParseStringToArraySync as Mock).mockReturnValue({
        headers: ["a"],
        fieldData: ["1"],
        actualFieldCounts: null,
        recordCount: 1,
        fieldCount: 1,
      });

      expect(() => parseStringToArraySyncWasm("a\n1")).not.toThrow();
    });

    it("should check initialization state on every call", () => {
      (isInitialized as Mock).mockReturnValue(true);
      (wasmParseStringToArraySync as Mock).mockReturnValue({
        headers: [],
        fieldData: [],
        actualFieldCounts: null,
        recordCount: 0,
        fieldCount: 0,
      });

      parseStringToArraySyncWasm("");
      parseStringToArraySyncWasm("");
      parseStringToArraySyncWasm("");

      // Should have checked initialization 3 times
      expect(isInitialized).toHaveBeenCalledTimes(3);
    });
  });

  describe("error message clarity", () => {
    it("should provide clear actionable error message", () => {
      (isInitialized as Mock).mockReturnValue(false);

      try {
        parseStringToArraySyncWasm("");
        expect.fail("Should have thrown");
      } catch (error) {
        expect(error).toBeInstanceOf(RangeError);
        expect((error as Error).message).toContain(
          "Wasm module is not initialized",
        );
        expect((error as Error).message).toContain("Please call loadWasm()");
        expect((error as Error).message).toContain(
          "parseStringToArraySyncWasm()",
        );
        expect((error as Error).message).toContain("slim entry");
      }
    });

    it("should distinguish itself from main version error", () => {
      (isInitialized as Mock).mockReturnValue(false);

      try {
        parseStringToArraySyncWasm("");
        expect.fail("Should have thrown");
      } catch (error) {
        // Slim entry error specifically mentions "slim entry"
        // Main version error would mention auto-initialization failure
        expect((error as Error).message).toContain("slim entry");
        expect((error as Error).message).not.toContain("auto");
        expect((error as Error).message).not.toContain("initialization failed");
      }
    });
  });

  describe("slim entry characteristics", () => {
    it("should verify no auto-initialization behavior", () => {
      (isInitialized as Mock).mockReturnValue(false);

      // Attempting to parse without initialization should fail
      expect(() => parseStringToArraySyncWasm("")).toThrow();

      // Should not have called Wasm parser (no auto-init)
      expect(wasmParseStringToArraySync).not.toHaveBeenCalled();
    });
  });
});
