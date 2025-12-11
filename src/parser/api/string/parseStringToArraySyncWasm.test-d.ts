import { describe, expectTypeOf, it } from "vitest";
import type { CSVRecord } from "@/core/types.ts";
import { parseStringToArraySyncWasm } from "@/parser/api/string/parseStringToArraySyncWasm.main.node.ts";

describe("string parsing", () => {
  it("should CSV header of the parsed result will be string array", () => {
    type Result = ReturnType<typeof parseStringToArraySyncWasm>;
    expectTypeOf<Result>().toEqualTypeOf<CSVRecord<readonly string[]>[]>();
  });
});

describe("csv literal string parsing", () => {
  it("should csv header of the parsed result will be header's tuple", () => {
    type Result = ReturnType<
      typeof parseStringToArraySyncWasm<
        string,
        ",",
        '"',
        ["name", "age", "city", "zip"]
      >
    >;
    expectTypeOf<Result>().toExtend<
      CSVRecord<["name", "age", "city", "zip"]>[]
    >();
  });
});

describe("generics", () => {
  it("should CSV header of the parsed result should be the one specified in generics", () => {
    type Result1 = ReturnType<
      typeof parseStringToArraySyncWasm<
        string,
        ",",
        '"',
        ["name", "age", "city", "zip"]
      >
    >;
    expectTypeOf<Result1>().toEqualTypeOf<
      CSVRecord<["name", "age", "city", "zip"]>[]
    >();

    type Result2 = ReturnType<
      typeof parseStringToArraySyncWasm<
        string,
        "#",
        "$",
        ["name", "age", "city", "zip"]
      >
    >;
    expectTypeOf<Result2>().toEqualTypeOf<
      CSVRecord<["name", "age", "city", "zip"]>[]
    >();
  });
});
