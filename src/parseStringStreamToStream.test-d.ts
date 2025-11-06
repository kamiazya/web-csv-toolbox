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
    type Result1 = ReturnType<typeof parseStringStreamToStream<ReadableStream>>;
    expectTypeOf<Result1>().toEqualTypeOf<
      ReadableStream<CSVRecord<readonly string[]>>
    >();

    type Result2 = ReturnType<typeof parseStringStreamToStream<ReadableStream<string>>>;
    expectTypeOf<Result2>().toEqualTypeOf<ReadableStream<CSVRecord<readonly string[]>>>();
  });
});

describe("csv literal ReadableStream parsing", () => {
  const csv1 = `name,age,city,zip
Alice,24,New York,10001
Bob,36,Los Angeles,90001`;

  it("should csv header of the parsed result will be header's tuple", () => {
    type Result = ReturnType<typeof parseStringStreamToStream<ReadableStream<typeof csv1>>>;
    expectTypeOf<Result>().toEqualTypeOf<
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
    type Result = ReturnType<typeof parseStringStreamToStream<ReadableStream<typeof csv1>, "*", "$">>;
    expectTypeOf<Result>().toEqualTypeOf<
      ReadableStream<
        CSVRecord<readonly ["name", "*ag\ne\n", "city", "z*i\np*"]>
      >
    >();
  });
});

describe("generics", () => {
  it("should CSV header of the parsed result should be the one specified in generics", () => {
    type Result1 = ReturnType<typeof parseStringStreamToStream<ReadableStream, readonly ["name", "age", "city", "zip"]>>;
    expectTypeOf<Result1>().toEqualTypeOf<
      ReadableStream<CSVRecord<readonly ["name", "age", "city", "zip"]>>
    >();

    type Result2 = ReturnType<typeof parseStringStreamToStream<ReadableStream<string>, readonly ["name", "age", "city", "zip"]>>;
    expectTypeOf<Result2>().toEqualTypeOf<
      ReadableStream<CSVRecord<readonly ["name", "age", "city", "zip"]>>
    >();

    type Result3 = ReturnType<typeof parseStringStreamToStream<ReadableStream, readonly ["name", "age", "city", "zip"]>>;
    expectTypeOf<Result3>().toEqualTypeOf<
      ReadableStream<CSVRecord<readonly ["name", "age", "city", "zip"]>>
    >();

    type Result4 = ReturnType<typeof parseStringStreamToStream<ReadableStream<string>, readonly ["name", "age", "city", "zip"]>>;
    expectTypeOf<Result4>().toEqualTypeOf<
      ReadableStream<CSVRecord<readonly ["name", "age", "city", "zip"]>>
    >();

    type Result5 = ReturnType<typeof parseStringStreamToStream<ReadableStream, "#", "$", readonly ["name", "age", "city", "zip"]>>;
    expectTypeOf<Result5>().toEqualTypeOf<
      ReadableStream<CSVRecord<readonly ["name", "age", "city", "zip"]>>
    >();

    type Result6 = ReturnType<typeof parseStringStreamToStream<ReadableStream<string>, "#", "$", readonly ["name", "age", "city", "zip"]>>;
    expectTypeOf<Result6>().toEqualTypeOf<
      ReadableStream<CSVRecord<readonly ["name", "age", "city", "zip"]>>
    >();
  });
});
