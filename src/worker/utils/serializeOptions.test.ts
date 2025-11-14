import { describe, expect, it } from "vitest";
import type { ParseBinaryOptions, ParseOptions } from "@/core/types.ts";
import { serializeOptions } from "@/worker/utils/serializeOptions.ts";

describe("serializeOptions", () => {
  describe("Basic serialization", () => {
    it("should return undefined for undefined options", () => {
      const result = serializeOptions(undefined);
      expect(result).toBeUndefined();
    });

    it("should return empty object for empty options", () => {
      const result = serializeOptions({});
      expect(result).toEqual({});
    });

    it("should preserve serializable options", () => {
      const options: ParseOptions<["name", "age"]> = {
        delimiter: ",",
        quotation: '"',
      };
      const result = serializeOptions(options);
      expect(result).toEqual({
        delimiter: ",",
        quotation: '"',
      });
    });
  });

  describe("Non-serializable field removal", () => {
    it("should remove signal field", () => {
      const controller = new AbortController();
      const options: ParseOptions<["name"]> = {
        signal: controller.signal,
        delimiter: ",",
      };
      const result = serializeOptions(options);
      expect(result).not.toHaveProperty("signal");
      expect(result).toEqual({ delimiter: "," });
    });

    it("should remove workerPool field", () => {
      const options = {
        workerPool: { maxWorkers: 4 } as any,
        delimiter: ",",
      };
      const result = serializeOptions(options);
      expect(result).not.toHaveProperty("workerPool");
      expect(result).toEqual({ delimiter: "," });
    });

    it("should remove workerURL field", () => {
      const options = {
        workerURL: "/custom-worker.js",
        delimiter: ",",
      };
      const result = serializeOptions(options);
      expect(result).not.toHaveProperty("workerURL");
      expect(result).toEqual({ delimiter: "," });
    });

    it("should remove engine field", () => {
      const options = {
        engine: { worker: true, wasm: true },
        delimiter: ",",
      };
      const result = serializeOptions(options);
      expect(result).not.toHaveProperty("engine");
      expect(result).toEqual({ delimiter: "," });
    });

    it("should remove all non-serializable fields at once", () => {
      const controller = new AbortController();
      const options = {
        signal: controller.signal,
        workerPool: { maxWorkers: 4 } as any,
        workerURL: "/worker.js",
        engine: { worker: true },
        delimiter: ",",
        quotation: '"',
      };
      const result = serializeOptions(options);
      expect(result).toEqual({
        delimiter: ",",
        quotation: '"',
      });
    });
  });

  describe("ParseOptions fields", () => {
    it("should preserve header option", () => {
      const options: ParseOptions<["name", "age"]> = {
        header: ["name", "age"],
      };
      const result = serializeOptions(options);
      expect(result).toEqual({ header: ["name", "age"] });
    });

    it("should preserve delimiter option", () => {
      const options = {
        delimiter: ";",
      } as any;
      const result = serializeOptions(options);
      expect(result).toEqual({ delimiter: ";" } as any);
    });

    it("should preserve quotation option", () => {
      const options = {
        quotation: "'",
      } as any;
      const result = serializeOptions(options);
      expect(result).toEqual({ quotation: "'" } as any);
    });

    it("should preserve decompression option", () => {
      const options: ParseBinaryOptions<["name"]> = {
        decompression: "gzip",
      };
      const result = serializeOptions(options);
      expect(result).toEqual({ decompression: "gzip" });
    });

    it("should preserve charset option", () => {
      const options: ParseBinaryOptions<["name"]> = {
        charset: "utf-8",
      };
      const result = serializeOptions(options);
      expect(result).toEqual({ charset: "utf-8" });
    });

    it("should preserve all valid ParseOptions fields", () => {
      const options: ParseOptions<["name", "age", "city"]> = {
        header: ["name", "age", "city"],
        delimiter: ",",
        quotation: '"',
      };
      const result = serializeOptions(options);
      expect(result).toEqual({
        header: ["name", "age", "city"],
        delimiter: ",",
        quotation: '"',
      });
    });
  });

  describe("ParseBinaryOptions fields", () => {
    it("should preserve all valid ParseBinaryOptions fields", () => {
      const options: ParseBinaryOptions<["name"]> = {
        delimiter: ",",
        quotation: '"',
        decompression: "gzip",
        charset: "utf-8",
      };
      const result = serializeOptions(options);
      expect(result).toEqual({
        delimiter: ",",
        quotation: '"',
        decompression: "gzip",
        charset: "utf-8",
      });
    });
  });

  describe("Type safety", () => {
    it("should accept ParseOptions", () => {
      const options: ParseOptions<["name"]> = {
        delimiter: ",",
      };
      const result = serializeOptions(options);
      expect(result).toBeDefined();
    });

    it("should accept ParseBinaryOptions", () => {
      const options: ParseBinaryOptions<["name"]> = {
        charset: "utf-8",
      };
      const result = serializeOptions(options);
      expect(result).toBeDefined();
    });

    it("should handle options with both ParseOptions and ParseBinaryOptions fields", () => {
      const options = {
        header: ["name", "age"],
        delimiter: ",",
        decompression: "gzip",
        charset: "utf-8",
      } as ParseBinaryOptions<["name", "age"]>;
      const result = serializeOptions(options);
      expect(result).toEqual({
        header: ["name", "age"],
        delimiter: ",",
        decompression: "gzip",
        charset: "utf-8",
      });
    });
  });

  describe("Edge cases", () => {
    it("should handle options with null values", () => {
      const options = {
        delimiter: null,
        quotation: undefined,
      } as any;
      const result = serializeOptions(options);
      expect(result).toEqual({
        delimiter: null,
        quotation: undefined,
      });
    });

    it("should handle options with empty strings", () => {
      const options = {
        delimiter: "",
        quotation: "",
      } as any;
      const result = serializeOptions(options);
      expect(result).toEqual({
        delimiter: "" as string,
        quotation: "" as string,
      });
    });

    it("should not mutate original options object", () => {
      const controller = new AbortController();
      const options = {
        signal: controller.signal,
        delimiter: ",",
      };
      const originalCopy = { ...options };
      serializeOptions(options);
      expect(options).toEqual(originalCopy);
    });
  });

  describe("Real-world scenarios", () => {
    it("should serialize options for worker message passing", () => {
      const controller = new AbortController();
      const options: ParseOptions<["name", "age"]> = {
        header: ["name", "age"],
        delimiter: ",",
        quotation: '"',
        signal: controller.signal,
        engine: { worker: true, wasm: true, workerURL: "/custom-worker.js" },
      };
      const result = serializeOptions(options);
      expect(result).toEqual({
        header: ["name", "age"],
        delimiter: ",",
        quotation: '"',
      });
    });

    it("should serialize binary options for worker", () => {
      const options = {
        header: ["col1", "col2"],
        charset: "utf-8",
        decompression: "gzip",
        delimiter: ";",
        signal: new AbortController().signal,
        engine: { worker: true },
      } as any;
      const result = serializeOptions(options);
      expect(result).toEqual({
        header: ["col1", "col2"],
        charset: "utf-8",
        decompression: "gzip",
        delimiter: ";" as string,
      });
    });
  });
});
