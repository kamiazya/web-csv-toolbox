import { describe, expectTypeOf, it } from "vitest";
import type { CSVArrayRecord, CSVRecord } from "@/core/types.ts";
import { parseStringToStream } from "@/parser/api/string/parseStringToStream.ts";

describe("parseStringToStream function", () => {
  it("parseStringToStream should be a function", () => {
    expectTypeOf(parseStringToStream).toBeFunction();
  });
});

describe("string parsing", () => {
  it("should CSV header of the parsed result will be string array", () => {
    expectTypeOf(parseStringToStream("" as string)).toEqualTypeOf<
      ReadableStream<CSVRecord<readonly string[]>>
    >();
  });
});

describe("csv literal string parsing", () => {
  const csv1 = `name,age,city,zip
Alice,24,New York,10001
Bob,36,Los Angeles,90001`;

  it("should csv header of the parsed result will be header's tuple", () => {
    expectTypeOf(parseStringToStream(csv1)).toEqualTypeOf<
      ReadableStream<CSVRecord<readonly ["name", "age", "city", "zip"]>>
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
      parseStringToStream<typeof csv1, "*", "$">(csv1, {
        delimiter: "*",
        quotation: "$",
      }),
    ).toEqualTypeOf<
      ReadableStream<
        CSVRecord<readonly ["name", "*ag\ne\n", "city", "z*i\np*"]>
      >
    >();
  });
});

describe("generics", () => {
  it("should CSV header of the parsed result should be the one specified in generics", () => {
    expectTypeOf(
      parseStringToStream<readonly ["name", "age", "city", "zip"]>(""),
    ).toEqualTypeOf<
      ReadableStream<CSVRecord<readonly ["name", "age", "city", "zip"]>>
    >();

    expectTypeOf(
      parseStringToStream<string, readonly ["name", "age", "city", "zip"]>(""),
    ).toEqualTypeOf<
      ReadableStream<CSVRecord<readonly ["name", "age", "city", "zip"]>>
    >();

    expectTypeOf(
      parseStringToStream<
        string,
        "#",
        "$",
        readonly ["name", "age", "city", "zip"]
      >("", {
        delimiter: "#",
        quotation: "$",
      }),
    ).toEqualTypeOf<
      ReadableStream<CSVRecord<readonly ["name", "age", "city", "zip"]>>
    >();
  });
});

describe("array output format", () => {
  it("should return ReadableStream of CSVArrayRecord when outputFormat is 'array'", () => {
    expectTypeOf(
      parseStringToStream("" as string, { outputFormat: "array" as const }),
    ).toEqualTypeOf<ReadableStream<CSVArrayRecord<readonly string[]>>>();
  });

  it("should return ReadableStream of CSVArrayRecord with csv literal inference", () => {
    const csv1 = `name,age,city,zip
Alice,24,New York,10001
Bob,36,Los Angeles,90001`;

    expectTypeOf(
      parseStringToStream(csv1, { outputFormat: "array" as const }),
    ).toEqualTypeOf<
      ReadableStream<CSVArrayRecord<readonly ["name", "age", "city", "zip"]>>
    >();
  });

  // Type test skipped due to TypeScript limitations with ReadableStream generics

  it("should return ReadableStream of CSVObjectRecord when outputFormat is 'object'", () => {
    expectTypeOf(
      parseStringToStream("" as string, { outputFormat: "object" as const }),
    ).toEqualTypeOf<ReadableStream<CSVRecord<readonly string[]>>>();
  });
});
