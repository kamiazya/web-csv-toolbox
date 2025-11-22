import { describe, expectTypeOf, it } from "vitest";
import type { CSVRecord } from "@/core/types.ts";
import { parseStringStream } from "@/parser/api/string/parseStringStream.ts";

describe("parseStringStream function", () => {
  it("parseStringStream should be a function", () => {
    expectTypeOf(parseStringStream).toBeFunction();
  });
});

describe("string ReadableStream parsing", () => {
  it("should CSV header of the parsed result will be string array", () => {
    const result1 = parseStringStream(new ReadableStream<string>());
    expectTypeOf(result1).toEqualTypeOf<
      AsyncIterableIterator<CSVRecord<readonly string[]>>
    >();

    const result2 = parseStringStream(new ReadableStream<string>());
    expectTypeOf(result2).toEqualTypeOf<
      AsyncIterableIterator<CSVRecord<readonly string[]>>
    >();
  });
});

describe("csv literal ReadableStream parsing", () => {
  const csv1 = `name,age,city,zip
Alice,24,New York,10001
Bob,36,Los Angeles,90001`;

  it("should csv header of the parsed result will be header's tuple", () => {
    const result = parseStringStream(new ReadableStream<typeof csv1>(), {
      header: ["name", "age", "city", "zip"] as const,
    });
    expectTypeOf(result).toEqualTypeOf<
      AsyncIterableIterator<CSVRecord<readonly ["name", "age", "city", "zip"]>>
    >();
  });
});

describe("csv literal ReadableStream parsing with line breaks, quotation, newline", () => {
  const _csv1 = `$name$*$*ag
e
$*$city$*$z*i
p*$
Alice*24*New York*$1000
$1$
Bob*$36$*$Los$
Angeles$*90001`;

  it("should csv header of the parsed result will be header's tuple", () => {
    expectTypeOf(
      parseStringStream<readonly string[]>(new ReadableStream<string>()),
    ).toEqualTypeOf<AsyncIterableIterator<CSVRecord<readonly string[]>>>();
  });
});

describe("generics", () => {
  it("should CSV header of the parsed result should be the one specified in generics", () => {
    expectTypeOf(
      parseStringStream<readonly ["name", "age", "city", "zip"]>(
        new ReadableStream<string>() as ReadableStream<string>,
      ),
    ).toEqualTypeOf<
      AsyncIterableIterator<CSVRecord<readonly ["name", "age", "city", "zip"]>>
    >();

    expectTypeOf(
      parseStringStream<readonly ["name", "age", "city", "zip"]>(
        new ReadableStream<string>() as ReadableStream<string>,
      ),
    ).toEqualTypeOf<
      AsyncIterableIterator<CSVRecord<readonly ["name", "age", "city", "zip"]>>
    >();

    expectTypeOf(
      parseStringStream<readonly ["name", "age", "city", "zip"]>(
        new ReadableStream<string>() as ReadableStream<string>,
      ),
    ).toEqualTypeOf<
      AsyncIterableIterator<CSVRecord<readonly ["name", "age", "city", "zip"]>>
    >();

    expectTypeOf(
      parseStringStream<readonly ["name", "age", "city", "zip"]>(
        new ReadableStream<string>() as ReadableStream<string>,
      ),
    ).toEqualTypeOf<
      AsyncIterableIterator<CSVRecord<readonly ["name", "age", "city", "zip"]>>
    >();
  });
});
