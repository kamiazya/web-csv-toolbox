import { describe, expectTypeOf, it } from "vitest";

import type { CSVRecord } from "@web-csv-toolbox/common";

import { parseString } from "./parseString";

describe("string parsing", () => {
  it("should CSV header of the parsed result will be string array", () => {
    expectTypeOf(parseString("" as string)).toEqualTypeOf<
      AsyncIterableIterator<CSVRecord<string[]>>
    >();
  });
});

describe("csv literal string parsing", () => {
  const csv1 = `name,age,city,zip
Alice,24,New York,10001
Bob,36,Los Angeles,90001`;

  it("should csv header of the parsed result will be header's tuple", () => {
    expectTypeOf(parseString(csv1)).toEqualTypeOf<
      AsyncIterableIterator<CSVRecord<["name", "age", "city", "zip"]>>
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
    expectTypeOf(
      parseString(csv1, { delimiter: "*", quotation: "$" }),
    ).toEqualTypeOf<
      AsyncIterableIterator<CSVRecord<["name", "*ag\ne\n", "city", "z*i\np*"]>>
    >();
  });
});

describe("generics", () => {
  it("should CSV header of the parsed result should be the one specified in generics", () => {
    expectTypeOf(parseString<["name", "age", "city", "zip"]>("")).toEqualTypeOf<
      AsyncIterableIterator<CSVRecord<["name", "age", "city", "zip"]>>
    >();

    expectTypeOf(
      parseString<string, "#", "$", ["name", "age", "city", "zip"]>("", {
        delimiter: "#",
        quotation: "$",
      }),
    ).toEqualTypeOf<
      AsyncIterableIterator<CSVRecord<["name", "age", "city", "zip"]>>
    >();
  });
});
