import fc from "fast-check";
import { describe, expect, test } from "vitest";
import type { ColumnCountStrategy } from "@/core/types.ts";
import { validateColumnCountStrategyForObject } from "./validateColumnCountStrategyForObject.ts";

describe("validateColumnCountStrategyForObject", () => {
  describe("valid strategies for object format", () => {
    test("should accept 'pad' strategy", () => {
      expect(() => validateColumnCountStrategyForObject("pad")).not.toThrow();
    });

    test("should accept 'truncate' strategy", () => {
      expect(() => validateColumnCountStrategyForObject("truncate")).not.toThrow();
    });

    test("should accept 'strict' strategy", () => {
      expect(() => validateColumnCountStrategyForObject("strict")).not.toThrow();
    });

    test("PBT: should accept any valid strategy except 'keep'", () => {
      const validStrategies: ColumnCountStrategy[] = ["pad", "truncate", "strict"];
      fc.assert(
        fc.property(fc.constantFrom(...validStrategies), (strategy) => {
          expect(() => validateColumnCountStrategyForObject(strategy)).not.toThrow();
        }),
      );
    });
  });

  describe("invalid strategies for object format", () => {
    test("should throw TypeError for 'keep' strategy", () => {
      expect(() => validateColumnCountStrategyForObject("keep")).toThrow(TypeError);
    });

    test("should throw with correct error message for 'keep'", () => {
      expect(() => validateColumnCountStrategyForObject("keep")).toThrow(
        /columnCountStrategy 'keep' is not supported for object format/,
      );
      expect(() => validateColumnCountStrategyForObject("keep")).toThrow(
        /Object format always maps to header keys/,
      );
      expect(() => validateColumnCountStrategyForObject("keep")).toThrow(
        /Use 'pad' \(default\), 'truncate', or 'strict' instead/,
      );
    });
  });

  describe("error type", () => {
    test("should throw TypeError (not Error or RangeError)", () => {
      try {
        validateColumnCountStrategyForObject("keep");
        expect.fail("Should have thrown");
      } catch (error) {
        expect(error).toBeInstanceOf(TypeError);
        expect(error).not.toBeInstanceOf(RangeError);
      }
    });
  });

  describe("consistency with object format semantics", () => {
    test("all strategies that work with header-key mapping should be valid", () => {
      // These strategies work by mapping values to header keys:
      // - pad: fills missing keys with undefined
      // - truncate: ignores extra values beyond header length
      // - strict: requires exact match to header length
      const headerCompatibleStrategies: ColumnCountStrategy[] = ["pad", "truncate", "strict"];

      for (const strategy of headerCompatibleStrategies) {
        expect(() => validateColumnCountStrategyForObject(strategy)).not.toThrow();
      }
    });

    test("'keep' is invalid because it preserves variable column counts", () => {
      // 'keep' returns rows with variable lengths, which doesn't make sense
      // for object format where every object needs consistent keys
      expect(() => validateColumnCountStrategyForObject("keep")).toThrow(TypeError);
    });
  });
});
