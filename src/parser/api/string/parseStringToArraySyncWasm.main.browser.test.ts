import type { Mock } from "vitest";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock dependencies
vi.mock("#/wasm/loaders/loadWasm.js", () => ({
  parseStringToArraySync: vi.fn(),
}));

vi.mock("#/wasm/loaders/loadWasmSync.js", () => ({
  loadWasmSync: vi.fn(),
  isSyncInitialized: vi.fn(),
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

import { parseStringToArraySync as wasmParseStringToArraySync } from "#/wasm/loaders/loadWasm.js";
import {
  isSyncInitialized,
  loadWasmSync,
} from "#/wasm/loaders/loadWasmSync.js";
import { parseStringToArraySyncWasm } from "./parseStringToArraySyncWasm.main.web.ts";
import { parseWithWasm } from "./parseStringToArraySyncWasm.shared.ts";

describe("parseStringToArraySyncWasm.main - auto-initialization", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("auto-initialization behavior", () => {
    it("should auto-initialize Wasm when not initialized", () => {
      (isSyncInitialized as Mock).mockReturnValue(false);
      (wasmParseStringToArraySync as Mock).mockReturnValue({
        headers: ["a", "b"],
        fieldData: ["1", "2"],
        actualFieldCounts: null,
        recordCount: 1,
        fieldCount: 2,
      });

      const csv = "a,b\n1,2";
      parseStringToArraySyncWasm(csv);

      expect(loadWasmSync).toHaveBeenCalledTimes(1);
      expect(isSyncInitialized).toHaveBeenCalled();
    });

    it("should not auto-initialize when already initialized", () => {
      (isSyncInitialized as Mock).mockReturnValue(true);
      (wasmParseStringToArraySync as Mock).mockReturnValue({
        headers: ["a", "b"],
        fieldData: ["1", "2"],
        actualFieldCounts: null,
        recordCount: 1,
        fieldCount: 2,
      });

      const csv = "a,b\n1,2";
      parseStringToArraySyncWasm(csv);

      expect(loadWasmSync).not.toHaveBeenCalled();
      expect(isSyncInitialized).toHaveBeenCalled();
    });

    it("should call isSyncInitialized before attempting initialization", () => {
      (isSyncInitialized as Mock).mockReturnValue(false);
      (wasmParseStringToArraySync as Mock).mockReturnValue({
        headers: [],
        fieldData: [],
        actualFieldCounts: null,
        recordCount: 0,
        fieldCount: 0,
      });

      parseStringToArraySyncWasm("");

      // isSyncInitialized should be called before loadWasmSync
      const initChecks = (isSyncInitialized as Mock).mock.invocationCallOrder;
      const syncLoads = (loadWasmSync as Mock).mock.invocationCallOrder;

      expect(initChecks[0]!).toBeLessThan(syncLoads[0]!);
    });

    it("should work for multiple calls after auto-initialization", () => {
      // First call: not initialized
      // Second call onwards: initialized
      (isSyncInitialized as Mock)
        .mockReturnValueOnce(false)
        .mockReturnValueOnce(true)
        .mockReturnValueOnce(true);

      (wasmParseStringToArraySync as Mock).mockReturnValue({
        headers: ["x"],
        fieldData: ["1"],
        actualFieldCounts: null,
        recordCount: 1,
        fieldCount: 1,
      });

      parseStringToArraySyncWasm("x\n1");
      parseStringToArraySyncWasm("x\n2");
      parseStringToArraySyncWasm("x\n3");

      // Should only call loadWasmSync once (first call)
      expect(loadWasmSync).toHaveBeenCalledTimes(1);
    });
  });

  describe("auto-initialization error handling", () => {
    it("should throw helpful error when initialization fails", () => {
      (isSyncInitialized as Mock).mockReturnValue(false);
      (loadWasmSync as Mock).mockImplementation(() => {
        throw new Error("Wasm binary not found");
      });

      expect(() => parseStringToArraySyncWasm("a,b\n1,2")).toThrow(RangeError);
      expect(() => parseStringToArraySyncWasm("a,b\n1,2")).toThrow(
        /Wasm initialization failed/,
      );
    });

    it("should include original error message in thrown error", () => {
      (isSyncInitialized as Mock).mockReturnValue(false);
      (loadWasmSync as Mock).mockImplementation(() => {
        throw new Error("Custom init error");
      });

      expect(() => parseStringToArraySyncWasm("")).toThrow(
        /Original error: Custom init error/,
      );
    });

    it("should include troubleshooting hints in error message", () => {
      (isSyncInitialized as Mock).mockReturnValue(false);
      (loadWasmSync as Mock).mockImplementation(() => {
        throw new Error("Init failed");
      });

      expect(() => parseStringToArraySyncWasm("")).toThrow(/Possible causes:/);
      expect(() => parseStringToArraySyncWasm("")).toThrow(
        /Unsupported runtime/,
      );
      expect(() => parseStringToArraySyncWasm("")).toThrow(
        /Wasm binary inaccessible/,
      );
      expect(() => parseStringToArraySyncWasm("")).toThrow(
        /Bundler configuration issues/,
      );
    });

    it("should handle non-Error thrown values", () => {
      (isSyncInitialized as Mock).mockReturnValue(false);
      (loadWasmSync as Mock).mockImplementation(() => {
        throw "String error";
      });

      expect(() => parseStringToArraySyncWasm("")).toThrow(
        /Original error: String error/,
      );
    });

    it("should not call Wasm parser when initialization fails", () => {
      (isSyncInitialized as Mock).mockReturnValue(false);
      (loadWasmSync as Mock).mockImplementation(() => {
        throw new Error("Init failed");
      });

      try {
        parseStringToArraySyncWasm("a,b\n1,2");
      } catch {
        // Error expected
      }

      expect(wasmParseStringToArraySync).not.toHaveBeenCalled();
    });
  });

  describe("successful parsing after auto-initialization", () => {
    it("should parse CSV correctly after auto-initialization", () => {
      (isSyncInitialized as Mock).mockReturnValue(false);
      (loadWasmSync as Mock).mockImplementation(() => {}); // Success
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
      expect(loadWasmSync).toHaveBeenCalledTimes(1);
    });

    it("should parse CSV with custom delimiter after auto-initialization", () => {
      (isSyncInitialized as Mock).mockReturnValue(false);
      (loadWasmSync as Mock).mockImplementation(() => {}); // Success
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
      expect(loadWasmSync).toHaveBeenCalledTimes(1);
    });

    it("should parse CSV with header row after auto-initialization", () => {
      (isSyncInitialized as Mock).mockReturnValue(false);
      (loadWasmSync as Mock).mockImplementation(() => {}); // Success
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
      expect(loadWasmSync).toHaveBeenCalledTimes(1);
    });
  });

  describe("integration with shared utilities", () => {
    it("should validate options before initialization", () => {
      (isSyncInitialized as Mock).mockReturnValue(false);

      // Invalid delimiter should throw before attempting initialization
      expect(() =>
        parseStringToArraySyncWasm("a,b", { delimiter: ",," as any }),
      ).toThrow(RangeError);
      expect(() =>
        parseStringToArraySyncWasm("a,b", { delimiter: ",," as any }),
      ).toThrow(/Invalid delimiter/);

      // loadWasmSync should not be called due to validation failure
      expect(loadWasmSync).not.toHaveBeenCalled();
    });

    it("should parse CSV with header from first row", () => {
      (isSyncInitialized as Mock).mockReturnValue(true);
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
      (isSyncInitialized as Mock).mockReturnValue(true);
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

  describe("comparison with slim entry", () => {
    it("should auto-initialize (unlike slim entry)", () => {
      (isSyncInitialized as Mock).mockReturnValue(false);
      (loadWasmSync as Mock).mockImplementation(() => {}); // Success
      (wasmParseStringToArraySync as Mock).mockReturnValue({
        headers: [],
        fieldData: [],
        actualFieldCounts: null,
        recordCount: 0,
        fieldCount: 0,
      });

      // Main version should auto-initialize
      expect(() => parseStringToArraySyncWasm("")).not.toThrow(
        /Wasm module is not initialized/,
      );

      expect(loadWasmSync).toHaveBeenCalledTimes(1);
    });

    it("should auto-initialize on first use for convenience", () => {
      // Main version auto-initializes for developer convenience
      (isSyncInitialized as Mock).mockReturnValue(false);
      (loadWasmSync as Mock).mockImplementation(() => {}); // Success
      (wasmParseStringToArraySync as Mock).mockReturnValue({
        headers: [],
        fieldData: [],
        actualFieldCounts: null,
        recordCount: 0,
        fieldCount: 0,
      });

      // Can use immediately without manual loadWasm call
      parseStringToArraySyncWasm("");

      expect(loadWasmSync).toHaveBeenCalled();
    });
  });

  describe("recommended usage patterns", () => {
    it("should work with preload pattern (recommended)", () => {
      // Recommended: User calls loadWasm() beforehand
      (isSyncInitialized as Mock).mockReturnValue(true);
      (wasmParseStringToArraySync as Mock).mockReturnValue({
        headers: ["a", "b"],
        fieldData: ["1", "2"],
        actualFieldCounts: null,
        recordCount: 1,
        fieldCount: 2,
      });

      // When pre-initialized, no auto-initialization needed
      const result = parseStringToArraySyncWasm("a,b\n1,2");

      expect(result).toEqual([{ a: "1", b: "2" }]);
      expect(loadWasmSync).not.toHaveBeenCalled();
    });

    it("should work with automatic pattern (convenient)", () => {
      // Convenient: User doesn't call loadWasm(), auto-initialized on first use
      (isSyncInitialized as Mock).mockReturnValue(false);
      (loadWasmSync as Mock).mockImplementation(() => {}); // Success
      (wasmParseStringToArraySync as Mock).mockReturnValue({
        headers: ["a", "b"],
        fieldData: ["1", "2"],
        actualFieldCounts: null,
        recordCount: 1,
        fieldCount: 2,
      });

      // Auto-initialization happens transparently
      const result = parseStringToArraySyncWasm("a,b\n1,2");

      expect(result).toEqual([{ a: "1", b: "2" }]);
      expect(loadWasmSync).toHaveBeenCalledTimes(1);
    });
  });

  describe("edge cases", () => {
    it("should handle empty CSV after auto-initialization", () => {
      (isSyncInitialized as Mock).mockReturnValue(false);
      (loadWasmSync as Mock).mockImplementation(() => {}); // Success
      (wasmParseStringToArraySync as Mock).mockReturnValue({
        headers: [],
        fieldData: [],
        actualFieldCounts: null,
        recordCount: 0,
        fieldCount: 0,
      });

      const result = parseStringToArraySyncWasm("");

      expect(result).toEqual([]);
      expect(loadWasmSync).toHaveBeenCalledTimes(1);
    });

    it("should handle large CSV after auto-initialization", () => {
      (isSyncInitialized as Mock).mockReturnValue(false);
      (loadWasmSync as Mock).mockImplementation(() => {}); // Success
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
      expect(loadWasmSync).toHaveBeenCalledTimes(1);
    });

    it("should handle special characters in CSV after auto-initialization", () => {
      (isSyncInitialized as Mock).mockReturnValue(false);
      (loadWasmSync as Mock).mockImplementation(() => {}); // Success
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
      expect(loadWasmSync).toHaveBeenCalledTimes(1);
    });
  });

  describe("state consistency", () => {
    it("should maintain consistent state across multiple parses", () => {
      // First parse: auto-initialize
      (isSyncInitialized as Mock).mockReturnValueOnce(false);
      (loadWasmSync as Mock).mockImplementation(() => {}); // Success
      (wasmParseStringToArraySync as Mock).mockReturnValue({
        headers: ["a"],
        fieldData: ["1"],
        actualFieldCounts: null,
        recordCount: 1,
        fieldCount: 1,
      });

      parseStringToArraySyncWasm("a\n1");
      expect(loadWasmSync).toHaveBeenCalledTimes(1);

      // Subsequent parses: already initialized
      (isSyncInitialized as Mock).mockReturnValue(true);

      parseStringToArraySyncWasm("a\n2");
      parseStringToArraySyncWasm("a\n3");

      // Should still only have 1 initialization
      expect(loadWasmSync).toHaveBeenCalledTimes(1);
    });

    it("should not pollute state on error", () => {
      (isSyncInitialized as Mock).mockReturnValue(false);
      (loadWasmSync as Mock).mockImplementation(() => {
        throw new Error("Init failed");
      });

      // First attempt: fails
      try {
        parseStringToArraySyncWasm("a,b");
      } catch {
        // Error expected
      }

      // Should attempt initialization again on next call
      (isSyncInitialized as Mock).mockReturnValue(false);

      try {
        parseStringToArraySyncWasm("c,d");
      } catch {
        // Error expected
      }

      // Should have tried to initialize both times
      expect(loadWasmSync).toHaveBeenCalledTimes(2);
    });
  });
});
