import { describe, expectTypeOf, it } from "vitest";
import { parseStringStreamToStream } from "./parseStringStreamToStream.ts";
import type { CSVRecord, ParseOptions } from "./web-csv-toolbox.ts";

describe("parseStringStreamToStream function", () => {
  it("parseStringStreamToStream should be a function with expected parameter types", () => {
    expectTypeOf(parseStringStreamToStream).toBeFunction();
    expectTypeOf(parseStringStreamToStream)
      .parameter(0)
      .toMatchTypeOf<ReadableStream>();
    expectTypeOf(parseStringStreamToStream)
      .parameter(1)
      .toMatchTypeOf<ParseOptions<readonly string[]> | undefined>();
  });
});

describe("string ReadableStream parsing", () => {
  it("should CSV header of the parsed result will be string array", () => {
    expectTypeOf(parseStringStreamToStream({} as ReadableStream)).toEqualTypeOf<
      ReadableStream<CSVRecord<readonly string[]>>
    >();

    expectTypeOf(
      parseStringStreamToStream({} as ReadableStream<string>),
    ).toEqualTypeOf<ReadableStream<CSVRecord<readonly string[]>>>();
  });
});

describe("csv literal ReadableStream parsing", () => {
  const csv1 = `name,age,city,zip
Alice,24,New York,10001
Bob,36,Los Angeles,90001`;

  it("should csv header of the parsed result will be header's tuple", () => {
    expectTypeOf(
      parseStringStreamToStream(new ReadableStream<typeof csv1>()),
    ).toEqualTypeOf<
      ReadableStream<CSVRecord<readonly ["name", "age", "city", "zip"]>>
    >();
  });
});

describe("csv literal ReadableStream parsing with line breaks, quotation, newline", () => {
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
      parseStringStreamToStream(new ReadableStream<typeof csv1>(), {
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
      parseStringStreamToStream<readonly ["name", "age", "city", "zip"]>(
        {} as ReadableStream,
      ),
    ).toEqualTypeOf<
      ReadableStream<CSVRecord<readonly ["name", "age", "city", "zip"]>>
    >();

    expectTypeOf(
      parseStringStreamToStream<readonly ["name", "age", "city", "zip"]>(
        {} as ReadableStream<string>,
      ),
    ).toEqualTypeOf<
      ReadableStream<CSVRecord<readonly ["name", "age", "city", "zip"]>>
    >();

    expectTypeOf(
      parseStringStreamToStream<
        ReadableStream,
        readonly ["name", "age", "city", "zip"]
      >({} as ReadableStream),
    ).toEqualTypeOf<
      ReadableStream<CSVRecord<readonly ["name", "age", "city", "zip"]>>
    >();

    expectTypeOf(
      parseStringStreamToStream<
        ReadableStream<string>,
        readonly ["name", "age", "city", "zip"]
      >({} as ReadableStream<string>),
    ).toEqualTypeOf<
      ReadableStream<CSVRecord<readonly ["name", "age", "city", "zip"]>>
    >();

    expectTypeOf(
      parseStringStreamToStream<
        ReadableStream,
        "#",
        "$",
        readonly ["name", "age", "city", "zip"]
      >({} as ReadableStream, {
        delimiter: "#",
        quotation: "$",
      }),
    ).toEqualTypeOf<
      ReadableStream<CSVRecord<readonly ["name", "age", "city", "zip"]>>
    >();

    expectTypeOf(
      parseStringStreamToStream<
        ReadableStream<string>,
        "#",
        "$",
        readonly ["name", "age", "city", "zip"]
      >({} as ReadableStream<string>, {
        delimiter: "#",
        quotation: "$",
      }),
    ).toEqualTypeOf<
      ReadableStream<CSVRecord<readonly ["name", "age", "city", "zip"]>>
    >();
  });
});
