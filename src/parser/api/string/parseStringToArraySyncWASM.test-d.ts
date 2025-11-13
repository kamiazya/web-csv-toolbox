import { describe, expectTypeOf, it } from "vitest";
import type { parseStringToArraySyncWASM } from "../string/parseStringToArraySyncWASM.ts";
import type { CSVRecord } from "./web-csv-toolbox.ts";

describe("string parsing", () => {
  it("should CSV header of the parsed result will be string array", () => {
    type Result = ReturnType<typeof parseStringToArraySyncWASM<string>>;
    expectTypeOf<Result>().toEqualTypeOf<CSVRecord<readonly string[]>[]>();
  });
});

describe("csv literal string parsing", () => {
  const csv1 = `name,age,city,zip
Alice,24,New York,10001
Bob,36,Los Angeles,90001`;

  it("should csv header of the parsed result will be header's tuple", () => {
    type Result = ReturnType<typeof parseStringToArraySyncWASM<typeof csv1>>;
    expectTypeOf<Result>().toMatchTypeOf<
      CSVRecord<["name", "age", "city", "zip"]>[]
    >();
  });
});

describe("csv literal string parsing with line breaks, quotation, newline", () => {
  const csv1 = `$name$*$*ag
e
$*$city$*$z*i
p*$
Alice*24*New York*$1000
$1$
Bob*$36$*$Los$
Angeles$*90001`;

  it("should csv header of the parsed result will be header's tuple", () => {
    // Note: WASM parser only supports double quote ("), not custom quotation
    // This test would fail at runtime, but we're only testing types here
    type Result = ReturnType<
      typeof parseStringToArraySyncWASM<typeof csv1, "*", "$">
    >;
    expectTypeOf<Result>().toMatchTypeOf<
      CSVRecord<readonly ["name", "*ag\ne\n", "city", "z*i\np*"]>[]
    >();
  });
});

describe("generics", () => {
  it("should CSV header of the parsed result should be the one specified in generics", () => {
    type Result1 = ReturnType<
      typeof parseStringToArraySyncWASM<
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
      typeof parseStringToArraySyncWASM<
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
