import type { Mock } from "vitest";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock dependencies
vi.mock("#/wasm/loaders/loadWASM.js", () => ({
  parseStringToArraySync: vi.fn(),
}));

vi.mock("#/wasm/loaders/loadWASMSync.js", () => ({
  loadWASMSync: vi.fn(),
  isSyncInitialized: vi.fn(),
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

import { parseStringToArraySync as wasmParseStringToArraySync } from "#/wasm/loaders/loadWASM.js";
import {
  isSyncInitialized,
  loadWASMSync,
} from "#/wasm/loaders/loadWASMSync.js";
import { parseStringToArraySyncWASM } from "./parseStringToArraySyncWASM.main.ts";
import { parseWithWASM } from "./parseStringToArraySyncWASM.shared.ts";

describe("parseStringToArraySyncWASM.main - auto-initialization", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("auto-initialization behavior", () => {
    it("should auto-initialize WASM when not initialized", () => {
      (isSyncInitialized as Mock).mockReturnValue(false);
      (wasmParseStringToArraySync as Mock).mockReturnValue(
        '[{"a":"1","b":"2"}]',
      );

      const csv = "a,b\n1,2";
      parseStringToArraySyncWASM(csv);

      expect(loadWASMSync).toHaveBeenCalledTimes(1);
      expect(isSyncInitialized).toHaveBeenCalled();
    });

    it("should not auto-initialize when already initialized", () => {
      (isSyncInitialized as Mock).mockReturnValue(true);
      (wasmParseStringToArraySync as Mock).mockReturnValue(
        '[{"a":"1","b":"2"}]',
      );

      const csv = "a,b\n1,2";
      parseStringToArraySyncWASM(csv);

      expect(loadWASMSync).not.toHaveBeenCalled();
      expect(isSyncInitialized).toHaveBeenCalled();
    });

    it("should call isSyncInitialized before attempting initialization", () => {
      (isSyncInitialized as Mock).mockReturnValue(false);
      (wasmParseStringToArraySync as Mock).mockReturnValue("[]");

      parseStringToArraySyncWASM("");

      // isSyncInitialized should be called before loadWASMSync
      const initChecks = (isSyncInitialized as Mock).mock.invocationCallOrder;
      const syncLoads = (loadWASMSync as Mock).mock.invocationCallOrder;

      expect(initChecks[0]!).toBeLessThan(syncLoads[0]!);
    });

    it("should work for multiple calls after auto-initialization", () => {
      // First call: not initialized
      // Second call onwards: initialized
      (isSyncInitialized as Mock)
        .mockReturnValueOnce(false)
        .mockReturnValueOnce(true)
        .mockReturnValueOnce(true);

      (wasmParseStringToArraySync as Mock).mockReturnValue('[{"x":"1"}]');

      parseStringToArraySyncWASM("x\n1");
      parseStringToArraySyncWASM("x\n2");
      parseStringToArraySyncWASM("x\n3");

      // Should only call loadWASMSync once (first call)
      expect(loadWASMSync).toHaveBeenCalledTimes(1);
    });
  });

  describe("auto-initialization error handling", () => {
    it("should throw helpful error when initialization fails", () => {
      (isSyncInitialized as Mock).mockReturnValue(false);
      (loadWASMSync as Mock).mockImplementation(() => {
        throw new Error("WASM binary not found");
      });

      expect(() => parseStringToArraySyncWASM("a,b\n1,2")).toThrow(RangeError);
      expect(() => parseStringToArraySyncWASM("a,b\n1,2")).toThrow(
        /WASM initialization failed/,
      );
    });

    it("should include original error message in thrown error", () => {
      (isSyncInitialized as Mock).mockReturnValue(false);
      (loadWASMSync as Mock).mockImplementation(() => {
        throw new Error("Custom init error");
      });

      expect(() => parseStringToArraySyncWASM("")).toThrow(
        /Original error: Custom init error/,
      );
    });

    it("should include troubleshooting hints in error message", () => {
      (isSyncInitialized as Mock).mockReturnValue(false);
      (loadWASMSync as Mock).mockImplementation(() => {
        throw new Error("Init failed");
      });

      expect(() => parseStringToArraySyncWASM("")).toThrow(/Possible causes:/);
      expect(() => parseStringToArraySyncWASM("")).toThrow(
        /Unsupported runtime/,
      );
      expect(() => parseStringToArraySyncWASM("")).toThrow(
        /WASM binary inaccessible/,
      );
      expect(() => parseStringToArraySyncWASM("")).toThrow(
        /Bundler configuration issues/,
      );
    });

    it("should handle non-Error thrown values", () => {
      (isSyncInitialized as Mock).mockReturnValue(false);
      (loadWASMSync as Mock).mockImplementation(() => {
        throw "String error";
      });

      expect(() => parseStringToArraySyncWASM("")).toThrow(
        /Original error: String error/,
      );
    });

    it("should not call WASM parser when initialization fails", () => {
      (isSyncInitialized as Mock).mockReturnValue(false);
      (loadWASMSync as Mock).mockImplementation(() => {
        throw new Error("Init failed");
      });

      try {
        parseStringToArraySyncWASM("a,b\n1,2");
      } catch {
        // Error expected
      }

      expect(wasmParseStringToArraySync).not.toHaveBeenCalled();
    });
  });

  describe("successful parsing after auto-initialization", () => {
    it("should parse CSV correctly after auto-initialization", () => {
      (isSyncInitialized as Mock).mockReturnValue(false);
      (loadWASMSync as Mock).mockImplementation(() => {}); // Success
      (wasmParseStringToArraySync as Mock).mockReturnValue(
        '[{"name":"Alice","age":"30"}]',
      );

      const csv = "name,age\nAlice,30";
      const result = parseStringToArraySyncWASM(csv);

      expect(result).toEqual([{ name: "Alice", age: "30" }]);
      expect(loadWASMSync).toHaveBeenCalledTimes(1);
    });

    it("should parse CSV with custom delimiter after auto-initialization", () => {
      (isSyncInitialized as Mock).mockReturnValue(false);
      (loadWASMSync as Mock).mockImplementation(() => {}); // Success
      (wasmParseStringToArraySync as Mock).mockReturnValue(
        '[{"a":"1","b":"2"}]',
      );

      const csv = "a\tb\n1\t2";
      const result = parseStringToArraySyncWASM(csv, { delimiter: "\t" });

      expect(result).toEqual([{ a: "1", b: "2" }]);
      expect(loadWASMSync).toHaveBeenCalledTimes(1);
    });

    it("should parse CSV with header row after auto-initialization", () => {
      (isSyncInitialized as Mock).mockReturnValue(false);
      (loadWASMSync as Mock).mockImplementation(() => {}); // Success
      (wasmParseStringToArraySync as Mock).mockReturnValue(
        '[{"x":"1","y":"2"}]',
      );

      const csv = "x,y\n1,2";
      const result = parseStringToArraySyncWASM(csv);

      expect(result).toEqual([{ x: "1", y: "2" }]);
      expect(loadWASMSync).toHaveBeenCalledTimes(1);
    });
  });

  describe("integration with shared utilities", () => {
    it("should validate options before initialization", () => {
      (isSyncInitialized as Mock).mockReturnValue(false);

      // Invalid delimiter should throw before attempting initialization
      expect(() =>
        parseStringToArraySyncWASM("a,b", { delimiter: ",," as any }),
      ).toThrow(RangeError);
      expect(() =>
        parseStringToArraySyncWASM("a,b", { delimiter: ",," as any }),
      ).toThrow(/Invalid delimiter/);

      // loadWASMSync should not be called due to validation failure
      expect(loadWASMSync).not.toHaveBeenCalled();
    });

    it("should parse CSV with header from first row", () => {
      (isSyncInitialized as Mock).mockReturnValue(true);
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
      (isSyncInitialized as Mock).mockReturnValue(true);
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

  describe("comparison with lite version", () => {
    it("should auto-initialize (unlike lite version)", () => {
      (isSyncInitialized as Mock).mockReturnValue(false);
      (loadWASMSync as Mock).mockImplementation(() => {}); // Success
      (wasmParseStringToArraySync as Mock).mockReturnValue("[]");

      // Main version should auto-initialize
      expect(() => parseStringToArraySyncWASM("")).not.toThrow(
        /WASM module is not initialized/,
      );

      expect(loadWASMSync).toHaveBeenCalledTimes(1);
    });

    it("should auto-initialize on first use for convenience", () => {
      // Main version auto-initializes for developer convenience
      (isSyncInitialized as Mock).mockReturnValue(false);
      (loadWASMSync as Mock).mockImplementation(() => {}); // Success
      (wasmParseStringToArraySync as Mock).mockReturnValue("[]");

      // Can use immediately without manual loadWASM call
      parseStringToArraySyncWASM("");

      expect(loadWASMSync).toHaveBeenCalled();
    });
  });

  describe("recommended usage patterns", () => {
    it("should work with preload pattern (recommended)", () => {
      // Recommended: User calls loadWASM() beforehand
      (isSyncInitialized as Mock).mockReturnValue(true);
      (wasmParseStringToArraySync as Mock).mockReturnValue(
        '[{"a":"1","b":"2"}]',
      );

      // When pre-initialized, no auto-initialization needed
      const result = parseStringToArraySyncWASM("a,b\n1,2");

      expect(result).toEqual([{ a: "1", b: "2" }]);
      expect(loadWASMSync).not.toHaveBeenCalled();
    });

    it("should work with automatic pattern (convenient)", () => {
      // Convenient: User doesn't call loadWASM(), auto-initialized on first use
      (isSyncInitialized as Mock).mockReturnValue(false);
      (loadWASMSync as Mock).mockImplementation(() => {}); // Success
      (wasmParseStringToArraySync as Mock).mockReturnValue(
        '[{"a":"1","b":"2"}]',
      );

      // Auto-initialization happens transparently
      const result = parseStringToArraySyncWASM("a,b\n1,2");

      expect(result).toEqual([{ a: "1", b: "2" }]);
      expect(loadWASMSync).toHaveBeenCalledTimes(1);
    });
  });

  describe("edge cases", () => {
    it("should handle empty CSV after auto-initialization", () => {
      (isSyncInitialized as Mock).mockReturnValue(false);
      (loadWASMSync as Mock).mockImplementation(() => {}); // Success
      (wasmParseStringToArraySync as Mock).mockReturnValue("[]");

      const result = parseStringToArraySyncWASM("");

      expect(result).toEqual([]);
      expect(loadWASMSync).toHaveBeenCalledTimes(1);
    });

    it("should handle large CSV after auto-initialization", () => {
      (isSyncInitialized as Mock).mockReturnValue(false);
      (loadWASMSync as Mock).mockImplementation(() => {}); // Success
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
      expect(loadWASMSync).toHaveBeenCalledTimes(1);
    });

    it("should handle special characters in CSV after auto-initialization", () => {
      (isSyncInitialized as Mock).mockReturnValue(false);
      (loadWASMSync as Mock).mockImplementation(() => {}); // Success
      (wasmParseStringToArraySync as Mock).mockReturnValue(
        '[{"name":"O\'Reilly","desc":"Quote: \\"test\\""}]',
      );

      const csv = 'name,desc\n"O\'Reilly","Quote: ""test"""';
      const result = parseStringToArraySyncWASM(csv);

      expect(result).toEqual([{ name: "O'Reilly", desc: 'Quote: "test"' }]);
      expect(loadWASMSync).toHaveBeenCalledTimes(1);
    });
  });

  describe("state consistency", () => {
    it("should maintain consistent state across multiple parses", () => {
      // First parse: auto-initialize
      (isSyncInitialized as Mock).mockReturnValueOnce(false);
      (loadWASMSync as Mock).mockImplementation(() => {}); // Success
      (wasmParseStringToArraySync as Mock).mockReturnValue('[{"a":"1"}]');

      parseStringToArraySyncWASM("a\n1");
      expect(loadWASMSync).toHaveBeenCalledTimes(1);

      // Subsequent parses: already initialized
      (isSyncInitialized as Mock).mockReturnValue(true);

      parseStringToArraySyncWASM("a\n2");
      parseStringToArraySyncWASM("a\n3");

      // Should still only have 1 initialization
      expect(loadWASMSync).toHaveBeenCalledTimes(1);
    });

    it("should not pollute state on error", () => {
      (isSyncInitialized as Mock).mockReturnValue(false);
      (loadWASMSync as Mock).mockImplementation(() => {
        throw new Error("Init failed");
      });

      // First attempt: fails
      try {
        parseStringToArraySyncWASM("a,b");
      } catch {
        // Error expected
      }

      // Should attempt initialization again on next call
      (isSyncInitialized as Mock).mockReturnValue(false);

      try {
        parseStringToArraySyncWASM("c,d");
      } catch {
        // Error expected
      }

      // Should have tried to initialize both times
      expect(loadWASMSync).toHaveBeenCalledTimes(2);
    });
  });
});
