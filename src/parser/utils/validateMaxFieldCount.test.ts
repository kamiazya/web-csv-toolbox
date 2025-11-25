import fc from "fast-check";
import { describe, expect, test } from "vitest";
import { validateMaxFieldCount } from "./validateMaxFieldCount.ts";

describe("validateMaxFieldCount", () => {
  describe("valid values", () => {
    test("should accept positive integers", () => {
      expect(() => validateMaxFieldCount(1)).not.toThrow();
      expect(() => validateMaxFieldCount(100)).not.toThrow();
      expect(() => validateMaxFieldCount(1000000)).not.toThrow();
    });

    test("should accept Number.POSITIVE_INFINITY", () => {
      expect(() => validateMaxFieldCount(Number.POSITIVE_INFINITY)).not.toThrow();
    });

    test("PBT: should accept any positive integer", () => {
      fc.assert(
        fc.property(fc.integer({ min: 1, max: 1000000 }), (n) => {
          expect(() => validateMaxFieldCount(n)).not.toThrow();
        }),
      );
    });
  });

  describe("invalid values", () => {
    test("should throw RangeError for zero", () => {
      expect(() => validateMaxFieldCount(0)).toThrow(RangeError);
      expect(() => validateMaxFieldCount(0)).toThrow(
        "maxFieldCount must be a positive integer or Number.POSITIVE_INFINITY",
      );
    });

    test("should throw RangeError for negative integers", () => {
      expect(() => validateMaxFieldCount(-1)).toThrow(RangeError);
      expect(() => validateMaxFieldCount(-100)).toThrow(RangeError);
    });

    test("should throw RangeError for non-integer numbers", () => {
      expect(() => validateMaxFieldCount(1.5)).toThrow(RangeError);
      expect(() => validateMaxFieldCount(0.1)).toThrow(RangeError);
      expect(() => validateMaxFieldCount(100.99)).toThrow(RangeError);
    });

    test("should throw RangeError for NaN", () => {
      expect(() => validateMaxFieldCount(Number.NaN)).toThrow(RangeError);
    });

    test("should throw RangeError for NEGATIVE_INFINITY", () => {
      expect(() => validateMaxFieldCount(Number.NEGATIVE_INFINITY)).toThrow(RangeError);
    });

    test("PBT: should throw for any negative integer", () => {
      fc.assert(
        fc.property(fc.integer({ min: -1000000, max: -1 }), (n) => {
          expect(() => validateMaxFieldCount(n)).toThrow(RangeError);
        }),
      );
    });

    test("PBT: should throw for any non-integer decimal between 0 and 1", () => {
      fc.assert(
        fc.property(fc.double({ min: 0.01, max: 0.99, noNaN: true }), (n) => {
          expect(() => validateMaxFieldCount(n)).toThrow(RangeError);
        }),
      );
    });

    test("PBT: should throw for any positive non-integer", () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 1000 }).chain((base) =>
            fc.double({ min: 0.01, max: 0.99, noNaN: true }).map((decimal) => base + decimal),
          ),
          (n) => {
            expect(() => validateMaxFieldCount(n)).toThrow(RangeError);
          },
        ),
      );
    });
  });

  describe("error message", () => {
    test("should have consistent error message", () => {
      const expectedMessage =
        "maxFieldCount must be a positive integer or Number.POSITIVE_INFINITY";

      expect(() => validateMaxFieldCount(0)).toThrow(expectedMessage);
      expect(() => validateMaxFieldCount(-1)).toThrow(expectedMessage);
      expect(() => validateMaxFieldCount(1.5)).toThrow(expectedMessage);
      expect(() => validateMaxFieldCount(Number.NaN)).toThrow(expectedMessage);
    });
  });
});
