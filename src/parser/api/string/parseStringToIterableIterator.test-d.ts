import { describe, expectTypeOf, it } from "vitest";
import type { CSVArrayRecord, CSVRecord } from "@/core/types.ts";
import { parseStringToIterableIterator } from "@/parser/api/string/parseStringToIterableIterator.ts";

describe("parseStringToIterableIterator function", () => {
  it("parseStringToIterableIterator should be a function", () => {
    expectTypeOf(parseStringToIterableIterator).toBeFunction();
  });
});

describe("string parsing", () => {
  it("should CSV header of the parsed result will be string array", () => {
    expectTypeOf(parseStringToIterableIterator("" as string)).toEqualTypeOf<
      IterableIterator<CSVRecord<readonly string[]>>
    >();
  });
});

describe("csv literal string parsing", () => {
  const csv1 = `name,age,city,zip
Alice,24,New York,10001
Bob,36,Los Angeles,90001`;

  it("should csv header of the parsed result will be header's tuple", () => {
    expectTypeOf(parseStringToIterableIterator(csv1)).toEqualTypeOf<
      IterableIterator<CSVRecord<readonly ["name", "age", "city", "zip"]>>
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
      parseStringToIterableIterator<typeof csv1, "*", "$">(csv1, {
        delimiter: "*",
        quotation: "$",
      }),
    ).toEqualTypeOf<
      IterableIterator<
        CSVRecord<readonly ["name", "*ag\ne\n", "city", "z*i\np*"]>
      >
    >();
  });
});

describe("generics", () => {
  it("should CSV header of the parsed result should be the one specified in generics", () => {
    expectTypeOf(
      parseStringToIterableIterator<["name", "age", "city", "zip"]>(""),
    ).toEqualTypeOf<
      IterableIterator<CSVRecord<["name", "age", "city", "zip"]>>
    >();

    expectTypeOf(
      parseStringToIterableIterator<string, ["name", "age", "city", "zip"]>(""),
    ).toEqualTypeOf<
      IterableIterator<CSVRecord<["name", "age", "city", "zip"]>>
    >();

    expectTypeOf(
      parseStringToIterableIterator<
        string,
        "#",
        "$",
        ["name", "age", "city", "zip"]
      >("", {
        delimiter: "#",
        quotation: "$",
      }),
    ).toEqualTypeOf<
      IterableIterator<CSVRecord<["name", "age", "city", "zip"]>>
    >();
  });
});

describe("array output format", () => {
  const csv1 = `name,age,city,zip
Alice,24,New York,10001
Bob,36,Los Angeles,90001`;

  it("should return array records when outputFormat is 'array'", () => {
    expectTypeOf(
      parseStringToIterableIterator(csv1, { outputFormat: "array" }),
    ).toEqualTypeOf<
      IterableIterator<CSVArrayRecord<readonly ["name", "age", "city", "zip"]>>
    >();
  });

  it("should infer Named Tuple type from CSV literal with array output", () => {
    const iterator = parseStringToIterableIterator(csv1, {
      outputFormat: "array",
    });
    const result = iterator.next();
    if (!result.done) {
      // Named Tuple type should allow both index and property access
      expectTypeOf(result.value).toEqualTypeOf<
        CSVArrayRecord<readonly ["name", "age", "city", "zip"]>
      >();
    }
  });

  it("should return object records when outputFormat is 'object' (default)", () => {
    expectTypeOf(
      parseStringToIterableIterator(csv1, { outputFormat: "object" }),
    ).toEqualTypeOf<
      IterableIterator<
        CSVRecord<readonly ["name", "age", "city", "zip"], "object">
      >
    >();
  });

  it("should return object records when outputFormat is not specified", () => {
    expectTypeOf(parseStringToIterableIterator(csv1)).toEqualTypeOf<
      IterableIterator<
        CSVRecord<readonly ["name", "age", "city", "zip"], "object">
      >
    >();
  });
});
