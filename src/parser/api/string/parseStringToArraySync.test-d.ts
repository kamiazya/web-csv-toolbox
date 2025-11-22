import { describe, expectTypeOf, it } from "vitest";
import type { CSVArrayRecord, CSVRecord } from "@/core/types.ts";
import { parseStringToArraySync } from "@/parser/api/string/parseStringToArraySync.ts";

describe("parseStringToArraySync function", () => {
  it("parseStringToArraySync should be a function", () => {
    expectTypeOf(parseStringToArraySync).toBeFunction();
  });
});

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
    expectTypeOf(parseStringToArraySync(csv1)).toExtend<
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
      parseStringToArraySync<typeof csv1, "*", "$">(csv1, {
        delimiter: "*",
        quotation: "$",
      }),
    ).toExtend<CSVRecord<readonly ["name", "*ag\ne\n", "city", "z*i\np*"]>[]>();
  });
});

describe("generics", () => {
  it("should CSV header of the parsed result should be the one specified in generics", () => {
    expectTypeOf(
      parseStringToArraySync<readonly ["name", "age", "city", "zip"]>(""),
    ).toEqualTypeOf<CSVRecord<readonly ["name", "age", "city", "zip"]>[]>();

    expectTypeOf(
      parseStringToArraySync<string, readonly ["name", "age", "city", "zip"]>(
        "",
      ),
    ).toEqualTypeOf<CSVRecord<readonly ["name", "age", "city", "zip"]>[]>();

    expectTypeOf(
      parseStringToArraySync<
        string,
        "#",
        "$",
        readonly ["name", "age", "city", "zip"]
      >("", {
        delimiter: "#",
        quotation: "$",
      }),
    ).toEqualTypeOf<CSVRecord<readonly ["name", "age", "city", "zip"]>[]>();
  });
});

describe("array output format", () => {
  const csv1 = `name,age,city,zip
Alice,24,New York,10001
Bob,36,Los Angeles,90001`;

  it("should return array records when outputFormat is 'array'", () => {
    expectTypeOf(
      parseStringToArraySync(csv1, { outputFormat: "array" }),
    ).toEqualTypeOf<
      CSVArrayRecord<readonly ["name", "age", "city", "zip"]>[]
    >();
  });

  it("should infer Named Tuple type from CSV literal with array output", () => {
    const result = parseStringToArraySync(csv1, { outputFormat: "array" });
    // Verify the array type is correct
    expectTypeOf(result).toEqualTypeOf<
      CSVArrayRecord<readonly ["name", "age", "city", "zip"]>[]
    >();
  });

  it("should return object records when outputFormat is 'object' (default)", () => {
    expectTypeOf(
      parseStringToArraySync(csv1, { outputFormat: "object" }),
    ).toEqualTypeOf<
      CSVRecord<readonly ["name", "age", "city", "zip"], "object">[]
    >();
  });

  it("should return object records when outputFormat is not specified", () => {
    expectTypeOf(parseStringToArraySync(csv1)).toEqualTypeOf<
      CSVRecord<readonly ["name", "age", "city", "zip"], "object">[]
    >();
  });
});
