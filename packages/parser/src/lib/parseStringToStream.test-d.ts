import { describe, expectTypeOf, it } from "vitest";

import type { CSVRecord, ParseOptions } from "@web-csv-toolbox/common";

import { parseStringToStream } from "./parseStringToStream";

describe("parseStringToStream function", () => {
  it("parseStringToStream should be a function with expected parameter types", () => {
    expectTypeOf(parseStringToStream).toBeFunction();
    expectTypeOf(parseStringToStream).parameter(0).toMatchTypeOf<string>();
    expectTypeOf(parseStringToStream)
      .parameter(1)
      .toMatchTypeOf<ParseOptions<string[]> | undefined>();
  });
});

describe("string parsing", () => {
  it("should CSV header of the parsed result will be string array", () => {
    expectTypeOf(parseStringToStream("" as string)).toEqualTypeOf<
      ReadableStream<CSVRecord<string[]>>
    >();
  });
});

describe("csv literal string parsing", () => {
  const csv1 = `name,age,city,zip
Alice,24,New York,10001
Bob,36,Los Angeles,90001`;

  it("should csv header of the parsed result will be header's tuple", () => {
    expectTypeOf(parseStringToStream(csv1)).toEqualTypeOf<
      ReadableStream<CSVRecord<["name", "age", "city", "zip"]>>
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
      parseStringToStream(csv1, { delimiter: "*", quotation: "$" }),
    ).toEqualTypeOf<
      ReadableStream<CSVRecord<["name", "*ag\ne\n", "city", "z*i\np*"]>>
    >();
  });
});

describe("generics", () => {
  it("should CSV header of the parsed result should be the one specified in generics", () => {
    expectTypeOf(
      parseStringToStream<["name", "age", "city", "zip"]>(""),
    ).toEqualTypeOf<
      ReadableStream<CSVRecord<["name", "age", "city", "zip"]>>
    >();

    expectTypeOf(
      parseStringToStream<string, ["name", "age", "city", "zip"]>(""),
    ).toEqualTypeOf<
      ReadableStream<CSVRecord<["name", "age", "city", "zip"]>>
    >();

    expectTypeOf(
      parseStringToStream<string, "#", "$", ["name", "age", "city", "zip"]>(
        "",
        {
          delimiter: "#",
          quotation: "$",
        },
      ),
    ).toEqualTypeOf<
      ReadableStream<CSVRecord<["name", "age", "city", "zip"]>>
    >();
  });
});
