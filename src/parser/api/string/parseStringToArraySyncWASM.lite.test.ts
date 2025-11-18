import type { Mock } from "vitest";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock dependencies
vi.mock("web-csv-toolbox-wasm", () => ({
  parseStringToArraySync: vi.fn(),
}));

vi.mock("@/wasm/loaders/wasmState.ts", () => ({
  isInitialized: vi.fn(),
}));

vi.mock("./parseStringToArraySyncWASM.shared.ts", async () => {
  const actual = await vi.importActual<
    typeof import("./parseStringToArraySyncWASM.shared.ts")
  >("./parseStringToArraySyncWASM.shared.ts");
  return {
    ...actual,
    parseWithWASM: vi.fn((csv, delim, buffer, source, wasmFn) =>
      JSON.parse(wasmFn(csv, delim, buffer, source)),
    ),
  };
});

import { parseStringToArraySync as wasmParseStringToArraySync } from "web-csv-toolbox-wasm";
import { isInitialized } from "@/wasm/loaders/wasmState.ts";
import { parseStringToArraySyncWASM } from "./parseStringToArraySyncWASM.lite.ts";
import { parseWithWASM } from "./parseStringToArraySyncWASM.shared.ts";

describe("parseStringToArraySyncWASM.lite - manual initialization", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("manual initialization requirement", () => {
    it("should throw error when WASM not initialized", () => {
      (isInitialized as Mock).mockReturnValue(false);

      expect(() => parseStringToArraySyncWASM("a,b\n1,2")).toThrow(RangeError);
      expect(() => parseStringToArraySyncWASM("a,b\n1,2")).toThrow(
        /WASM module is not initialized/,
      );
    });

    it("should include helpful message about calling loadWASM()", () => {
      (isInitialized as Mock).mockReturnValue(false);

      expect(() => parseStringToArraySyncWASM("")).toThrow(
        /Please call loadWASM\(\) before using parseStringToArraySyncWASM\(\)/,
      );
    });

    it("should mention lite version in error message", () => {
      (isInitialized as Mock).mockReturnValue(false);

      expect(() => parseStringToArraySyncWASM("")).toThrow(/lite version/);
    });

    it("should not call WASM parser when not initialized", () => {
      (isInitialized as Mock).mockReturnValue(false);

      try {
        parseStringToArraySyncWASM("a,b\n1,2");
      } catch {
        // Error expected
      }

      expect(wasmParseStringToArraySync).not.toHaveBeenCalled();
    });

    it("should check initialization before attempting to parse", () => {
      (isInitialized as Mock).mockReturnValue(false);

      try {
        parseStringToArraySyncWASM("");
      } catch {
        // Error expected
      }

      expect(isInitialized).toHaveBeenCalled();
    });
  });

  describe("successful parsing when initialized", () => {
    it("should parse CSV correctly when initialized", () => {
      (isInitialized as Mock).mockReturnValue(true);
      (wasmParseStringToArraySync as Mock).mockReturnValue(
        '[{"name":"Alice","age":"30"}]',
      );

      const csv = "name,age\nAlice,30";
      const result = parseStringToArraySyncWASM(csv);

      expect(result).toEqual([{ name: "Alice", age: "30" }]);
      expect(isInitialized).toHaveBeenCalled();
    });

    it("should parse CSV with custom delimiter when initialized", () => {
      (isInitialized as Mock).mockReturnValue(true);
      (wasmParseStringToArraySync as Mock).mockReturnValue(
        '[{"a":"1","b":"2"}]',
      );

      const csv = "a\tb\n1\t2";
      const result = parseStringToArraySyncWASM(csv, { delimiter: "\t" });

      expect(result).toEqual([{ a: "1", b: "2" }]);
    });

    it("should parse CSV with header row when initialized", () => {
      (isInitialized as Mock).mockReturnValue(true);
      (wasmParseStringToArraySync as Mock).mockReturnValue(
        '[{"x":"1","y":"2"}]',
      );

      const csv = "x,y\n1,2";
      const result = parseStringToArraySyncWASM(csv);

      expect(result).toEqual([{ x: "1", y: "2" }]);
    });

    it("should work for multiple calls when initialized", () => {
      (isInitialized as Mock).mockReturnValue(true);
      (wasmParseStringToArraySync as Mock).mockReturnValue('[{"a":"1"}]');

      // Multiple calls should all succeed
      parseStringToArraySyncWASM("a\n1");
      parseStringToArraySyncWASM("a\n2");
      parseStringToArraySyncWASM("a\n3");

      expect(wasmParseStringToArraySync).toHaveBeenCalledTimes(3);
    });
  });

  describe("validation before initialization check", () => {
    it("should validate delimiter before checking initialization", () => {
      (isInitialized as Mock).mockReturnValue(true);

      // Invalid delimiter should throw before checking initialization
      expect(() =>
        parseStringToArraySyncWASM("a,b", { delimiter: ",," as any }),
      ).toThrow(RangeError);
      expect(() =>
        parseStringToArraySyncWASM("a,b", { delimiter: ",," as any }),
      ).toThrow(/Invalid delimiter/);
    });

    it("should validate quotation before checking initialization", () => {
      (isInitialized as Mock).mockReturnValue(true);

      // Invalid quotation should throw before checking initialization
      expect(() =>
        parseStringToArraySyncWASM("a,b", { quotation: "'" as any }),
      ).toThrow(RangeError);
      expect(() =>
        parseStringToArraySyncWASM("a,b", { quotation: "'" as any }),
      ).toThrow(/Invalid quotation/);
    });

    it("should prioritize validation errors over initialization errors", () => {
      (isInitialized as Mock).mockReturnValue(false);

      // When both validation and initialization fail, validation error should be thrown
      expect(() =>
        parseStringToArraySyncWASM("", { delimiter: "" as any }),
      ).toThrow(/Invalid delimiter/);
      expect(() =>
        parseStringToArraySyncWASM("", { delimiter: "" as any }),
      ).not.toThrow(/WASM module is not initialized/);
    });
  });

  describe("integration with shared utilities", () => {
    it("should parse CSV with header from first row", () => {
      (isInitialized as Mock).mockReturnValue(true);
      (wasmParseStringToArraySync as Mock).mockReturnValue(
        '[{"col1":"1","col2":"2"}]',
      );

      const csv = "col1,col2\n1,2";
      parseStringToArraySyncWASM(csv);

      // parseWithWASM should receive the CSV as-is
      expect(parseWithWASM).toHaveBeenCalledWith(
        csv,
        44, // delimiter code for ","
        10485760, // default maxBufferSize
        "", // default source
        wasmParseStringToArraySync,
      );
    });

    it("should pass validated options to parseWithWASM", () => {
      (isInitialized as Mock).mockReturnValue(true);
      (wasmParseStringToArraySync as Mock).mockReturnValue("[]");

      const csv = "a;b\n1;2";
      parseStringToArraySyncWASM(csv, {
        delimiter: ";",
        maxBufferSize: 2048,
        source: "test.csv",
      });

      expect(parseWithWASM).toHaveBeenCalledWith(
        csv,
        59, // delimiter code for ";"
        2048,
        "test.csv",
        wasmParseStringToArraySync,
      );
    });
  });

  describe("comparison with main version", () => {
    it("should NOT auto-initialize (unlike main version)", () => {
      (isInitialized as Mock).mockReturnValue(false);

      // Lite version should NOT auto-initialize, should throw error instead
      expect(() => parseStringToArraySyncWASM("")).toThrow(
        /WASM module is not initialized/,
      );

      // Should not have attempted any initialization
      expect(wasmParseStringToArraySync).not.toHaveBeenCalled();
    });

    it("should require explicit loadWASM() call", () => {
      (isInitialized as Mock).mockReturnValue(false);

      // Lite version characteristics:
      // - No auto-initialization
      // - Requires explicit loadWASM() call
      // - Smaller bundle size (~110KB smaller)
      // - Throws error if not initialized

      expect(() => parseStringToArraySyncWASM("")).toThrow(
        /Please call loadWASM\(\)/,
      );
    });

    it("should provide smaller bundle at cost of convenience", () => {
      // Lite version trade-offs:
      // - Smaller bundle (no inlined WASM)
      // - Requires manual initialization
      // - Better for bundle size optimization

      (isInitialized as Mock).mockReturnValue(false);

      // Cannot use immediately without manual loadWASM call
      expect(() => parseStringToArraySyncWASM("")).toThrow();
    });
  });

  describe("recommended usage pattern", () => {
    it("should work with manual initialization pattern (required)", () => {
      // Required pattern for lite version:
      // 1. User must call loadWASM() first
      // 2. Then can call parseStringToArraySyncWASM()

      (isInitialized as Mock).mockReturnValue(true); // Simulates loadWASM() was called
      (wasmParseStringToArraySync as Mock).mockReturnValue(
        '[{"a":"1","b":"2"}]',
      );

      // Now parsing should work
      const result = parseStringToArraySyncWASM("a,b\n1,2");

      expect(result).toEqual([{ a: "1", b: "2" }]);
    });

    it("should fail gracefully with clear error when not initialized", () => {
      // If user forgets to call loadWASM(), should get clear error

      (isInitialized as Mock).mockReturnValue(false);

      expect(() => parseStringToArraySyncWASM("a,b\n1,2")).toThrow(
        /WASM module is not initialized.*Please call loadWASM\(\)/,
      );
    });
  });

  describe("edge cases when initialized", () => {
    it("should handle empty CSV when initialized", () => {
      (isInitialized as Mock).mockReturnValue(true);
      (wasmParseStringToArraySync as Mock).mockReturnValue("[]");

      const result = parseStringToArraySyncWASM("");

      expect(result).toEqual([]);
    });

    it("should handle large CSV when initialized", () => {
      (isInitialized as Mock).mockReturnValue(true);
      const largeResult = JSON.stringify(
        Array.from({ length: 1000 }, (_, i) => ({
          id: String(i),
          value: String(i * 2),
        })),
      );
      (wasmParseStringToArraySync as Mock).mockReturnValue(largeResult);

      const csv =
        "id,value\n" +
        Array.from({ length: 1000 }, (_, i) => `${i},${i * 2}`).join("\n");
      const result = parseStringToArraySyncWASM(csv);

      expect(result).toHaveLength(1000);
    });

    it("should handle special characters when initialized", () => {
      (isInitialized as Mock).mockReturnValue(true);
      (wasmParseStringToArraySync as Mock).mockReturnValue(
        '[{"name":"O\'Reilly","desc":"Quote: \\"test\\""}]',
      );

      const csv = 'name,desc\n"O\'Reilly","Quote: ""test"""';
      const result = parseStringToArraySyncWASM(csv);

      expect(result).toEqual([{ name: "O'Reilly", desc: 'Quote: "test"' }]);
    });
  });

  describe("state consistency", () => {
    it("should consistently check initialization state", () => {
      // If state changes during execution, behavior should match current state

      // First call: not initialized
      (isInitialized as Mock).mockReturnValueOnce(false);
      expect(() => parseStringToArraySyncWASM("")).toThrow(
        /WASM module is not initialized/,
      );

      // Second call: now initialized (loadWASM was called in between)
      (isInitialized as Mock).mockReturnValueOnce(true);
      (wasmParseStringToArraySync as Mock).mockReturnValue('[{"a":"1"}]');

      expect(() => parseStringToArraySyncWASM("a\n1")).not.toThrow();
    });

    it("should check initialization state on every call", () => {
      (isInitialized as Mock).mockReturnValue(true);
      (wasmParseStringToArraySync as Mock).mockReturnValue("[]");

      parseStringToArraySyncWASM("");
      parseStringToArraySyncWASM("");
      parseStringToArraySyncWASM("");

      // Should have checked initialization 3 times
      expect(isInitialized).toHaveBeenCalledTimes(3);
    });
  });

  describe("error message clarity", () => {
    it("should provide clear actionable error message", () => {
      (isInitialized as Mock).mockReturnValue(false);

      try {
        parseStringToArraySyncWASM("");
        expect.fail("Should have thrown");
      } catch (error) {
        expect(error).toBeInstanceOf(RangeError);
        expect((error as Error).message).toContain(
          "WASM module is not initialized",
        );
        expect((error as Error).message).toContain("Please call loadWASM()");
        expect((error as Error).message).toContain(
          "parseStringToArraySyncWASM()",
        );
        expect((error as Error).message).toContain("lite version");
      }
    });

    it("should distinguish itself from main version error", () => {
      (isInitialized as Mock).mockReturnValue(false);

      try {
        parseStringToArraySyncWASM("");
        expect.fail("Should have thrown");
      } catch (error) {
        // Lite version error specifically mentions "lite version"
        // Main version error would mention auto-initialization failure
        expect((error as Error).message).toContain("lite version");
        expect((error as Error).message).not.toContain("auto");
        expect((error as Error).message).not.toContain("initialization failed");
      }
    });
  });

  describe("lite version characteristics", () => {
    it("should verify no auto-initialization behavior", () => {
      (isInitialized as Mock).mockReturnValue(false);

      // Attempting to parse without initialization should fail
      expect(() => parseStringToArraySyncWASM("")).toThrow();

      // Should not have called WASM parser (no auto-init)
      expect(wasmParseStringToArraySync).not.toHaveBeenCalled();
    });
  });
});
