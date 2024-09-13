import { describe, expectTypeOf, it } from "vitest";

import type {
  CSV,
  CSVBinary,
  CSVRecord,
  CSVString,
} from "@web-csv-toolbox/common";

import { parse } from "./parse.ts";

describe("parse function", () => {
  it("should return AsyncIterableIterator<>", () => {
    const result = parse("", { header: ["a", "b"] });
    expectTypeOf<typeof result>().toEqualTypeOf<
      AsyncIterableIterator<CSVRecord<["a", "b"]>>
    >();
  });
});

describe("binary parsing", () => {
  it("should CSV header of the parsed result will be string array", () => {
    expectTypeOf(parse({} as CSVBinary)).toEqualTypeOf<
      AsyncIterableIterator<CSVRecord<string[]>>
    >();
  });
});

describe("string parsing", () => {
  it("should CSV header of the parsed result will be string array", () => {
    expectTypeOf(parse("" as string)).toEqualTypeOf<
      AsyncIterableIterator<CSVRecord<string[]>>
    >();

    expectTypeOf(parse({} as ReadableStream)).toEqualTypeOf<
      AsyncIterableIterator<CSVRecord<string[]>>
    >();

    expectTypeOf(parse({} as ReadableStream<string>)).toEqualTypeOf<
      AsyncIterableIterator<CSVRecord<string[]>>
    >();

    expectTypeOf(parse("" as CSVString)).toEqualTypeOf<
      AsyncIterableIterator<CSVRecord<string[]>>
    >();
  });
});

describe("csv literal string parsing", () => {
  const csv1 = `name,age,city,zip
Alice,24,New York,10001
Bob,36,Los Angeles,90001`;

  it("should csv header of the parsed result will be header's tuple", () => {
    expectTypeOf(parse(csv1)).toEqualTypeOf<
      AsyncIterableIterator<CSVRecord<["name", "age", "city", "zip"]>>
    >();

    expectTypeOf(
      parse("" as CSVString<["name", "age", "city", "zip"]>),
    ).toEqualTypeOf<
      AsyncIterableIterator<CSVRecord<["name", "age", "city", "zip"]>>
    >();

    expectTypeOf(
      parse("" as CSV<["name", "age", "city", "zip"]>),
    ).toEqualTypeOf<
      AsyncIterableIterator<CSVRecord<["name", "age", "city", "zip"]>>
    >();

    expectTypeOf(parse(new ReadableStream<typeof csv1>())).toEqualTypeOf<
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
    expectTypeOf(parse(csv1, { delimiter: "*", quotation: "$" })).toEqualTypeOf<
      AsyncIterableIterator<CSVRecord<["name", "*ag\ne\n", "city", "z*i\np*"]>>
    >();

    expectTypeOf(
      parse("" as CSVString<["name", "age\n", "city", "zi\np"]>),
    ).toEqualTypeOf<
      AsyncIterableIterator<CSVRecord<["name", "age\n", "city", "zi\np"]>>
    >();

    expectTypeOf(
      parse("" as CSV<["name", "age\n", "city", "zi\np"]>),
    ).toEqualTypeOf<
      AsyncIterableIterator<CSVRecord<["name", "age\n", "city", "zi\np"]>>
    >();

    expectTypeOf(
      parse(new ReadableStream<typeof csv1>(), {
        delimiter: "*",
        quotation: "$",
      }),
    ).toEqualTypeOf<
      AsyncIterableIterator<CSVRecord<["name", "*ag\ne\n", "city", "z*i\np*"]>>
    >();
  });
});

describe("generics", () => {
  it("should CSV header of the parsed result should be the one specified in generics", () => {
    expectTypeOf(parse<["name", "age", "city", "zip"]>("")).toEqualTypeOf<
      AsyncIterableIterator<CSVRecord<["name", "age", "city", "zip"]>>
    >();

    expectTypeOf(
      parse<["name", "age", "city", "zip"]>({} as CSVBinary),
    ).toEqualTypeOf<
      AsyncIterableIterator<CSVRecord<["name", "age", "city", "zip"]>>
    >();

    expectTypeOf(
      parse<["name", "age", "city", "zip"]>({} as ReadableStream),
    ).toEqualTypeOf<
      AsyncIterableIterator<CSVRecord<["name", "age", "city", "zip"]>>
    >();

    expectTypeOf(
      parse<["name", "age", "city", "zip"]>({} as ReadableStream<string>),
    ).toEqualTypeOf<
      AsyncIterableIterator<CSVRecord<["name", "age", "city", "zip"]>>
    >();

    expectTypeOf(
      parse<["name", "age", "city", "zip"]>("" as CSVString),
    ).toEqualTypeOf<
      AsyncIterableIterator<CSVRecord<["name", "age", "city", "zip"]>>
    >();

    expectTypeOf(
      parse<string, "#", "$", ["name", "age", "city", "zip"]>("", {
        delimiter: "#",
        quotation: "$",
      }),
    ).toEqualTypeOf<
      AsyncIterableIterator<CSVRecord<["name", "age", "city", "zip"]>>
    >();

    expectTypeOf(
      parse<ReadableStream, "#", "$", ["name", "age", "city", "zip"]>(
        {} as ReadableStream,
        {
          delimiter: "#",
          quotation: "$",
        },
      ),
    ).toEqualTypeOf<
      AsyncIterableIterator<CSVRecord<["name", "age", "city", "zip"]>>
    >();

    expectTypeOf(
      parse<ReadableStream<string>, "#", "$", ["name", "age", "city", "zip"]>(
        {} as ReadableStream<string>,
        {
          delimiter: "#",
          quotation: "$",
        },
      ),
    ).toEqualTypeOf<
      AsyncIterableIterator<CSVRecord<["name", "age", "city", "zip"]>>
    >();

    expectTypeOf(
      parse<CSVString, "#", "$", ["name", "age", "city", "zip"]>(
        "" as CSVString,
        {
          delimiter: "#",
          quotation: "$",
        },
      ),
    ).toEqualTypeOf<
      AsyncIterableIterator<CSVRecord<["name", "age", "city", "zip"]>>
    >();
  });
});
