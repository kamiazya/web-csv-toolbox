import { describe, expectTypeOf, it } from "vitest";

import type { CSVRecord } from "@web-csv-toolbox/common";

import { parseStringToArraySync } from "./wasm.js";

describe("string parsing", () => {
  it("should CSV header of the parsed result will be string array", () => {
    expectTypeOf(parseStringToArraySync("" as string)).toEqualTypeOf<
      CSVRecord<readonly string[]>[]
    >();
  });
});

describe("csv literal string parsing", () => {
  const csv1 = `name,age,city,zip
Alice,24,New York,10001
Bob,36,Los Angeles,90001`;

  it("should csv header of the parsed result will be header's tuple", () => {
    expectTypeOf(parseStringToArraySync(csv1)).toMatchTypeOf<
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
    expectTypeOf(
      parseStringToArraySync(csv1, { delimiter: "*", quotation: "$" }),
    ).toMatchTypeOf<
      CSVRecord<readonly ["name", "*ag\ne\n", "city", "z*i\np*"]>[]
    >();
  });
});

describe("generics", () => {
  it("should CSV header of the parsed result should be the one specified in generics", () => {
    expectTypeOf(
      parseStringToArraySync<["name", "age", "city", "zip"]>(""),
    ).toEqualTypeOf<CSVRecord<["name", "age", "city", "zip"]>[]>();

    expectTypeOf(
      parseStringToArraySync<string, "#", "$", ["name", "age", "city", "zip"]>(
        "",
        {
          delimiter: "#",
          quotation: "$",
        },
      ),
    ).toEqualTypeOf<CSVRecord<["name", "age", "city", "zip"]>[]>();
  });
});
