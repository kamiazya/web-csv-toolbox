import { describe, expectTypeOf, it } from "vitest";
import type { CSVRecord, parseString } from "./web-csv-toolbox.ts";

describe("string parsing", () => {
  it("should CSV header of the parsed result will be string array", () => {
    type Result = ReturnType<typeof parseString<string>>;
    expectTypeOf<Result>().toEqualTypeOf<
      AsyncIterableIterator<CSVRecord<readonly string[]>>
    >();
  });
});

describe("csv literal string parsing", () => {
  const csv1 = `name,age,city,zip
Alice,24,New York,10001
Bob,36,Los Angeles,90001`;

  it("should csv header of the parsed result will be header's tuple", () => {
    type Result = ReturnType<typeof parseString<typeof csv1>>;
    expectTypeOf<Result>().toEqualTypeOf<
      AsyncIterableIterator<CSVRecord<readonly ["name", "age", "city", "zip"]>>
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
    type Result = ReturnType<typeof parseString<typeof csv1, "*", "$">>;
    expectTypeOf<Result>().toEqualTypeOf<
      AsyncIterableIterator<
        CSVRecord<readonly ["name", "*ag\ne\n", "city", "z*i\np*"]>
      >
    >();
  });
});

describe("generics", () => {
  it("should CSV header of the parsed result should be the one specified in generics", () => {
    type Result1 = ReturnType<
      typeof parseString<string, ",", '"', ["name", "age", "city", "zip"]>
    >;
    expectTypeOf<Result1>().toEqualTypeOf<
      AsyncIterableIterator<CSVRecord<["name", "age", "city", "zip"]>>
    >();

    type Result2 = ReturnType<
      typeof parseString<
        string,
        "#",
        "$",
        readonly ["name", "age", "city", "zip"]
      >
    >;
    expectTypeOf<Result2>().toEqualTypeOf<
      AsyncIterableIterator<CSVRecord<readonly ["name", "age", "city", "zip"]>>
    >();
  });
});
