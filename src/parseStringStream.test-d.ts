import { describe, expectTypeOf, it } from "vitest";
import { CR, CRLF, LF } from "./constants.ts";
import {
  type CSVRecord,
  type ParseOptions,
  parseStringStream,
} from "./web-csv-toolbox.ts";

describe("parseStringStream function", () => {
  it("parseStringStream should be a function with expected parameter types", () => {
    expectTypeOf(parseStringStream).toBeFunction();
    expectTypeOf(parseStringStream)
      .parameter(0)
      .toMatchTypeOf<ReadableStream<string>>();
    expectTypeOf(parseStringStream)
      .parameter(1)
      .toMatchTypeOf<ParseOptions<readonly string[]> | undefined>();
  });
});

describe("string ReadableStream parsing", () => {
  it("should CSV header of the parsed result will be string array", () => {
    expectTypeOf(parseStringStream({} as ReadableStream)).toEqualTypeOf<
      AsyncIterableIterator<CSVRecord<readonly string[]>>
    >();

    expectTypeOf(parseStringStream({} as ReadableStream<string>)).toEqualTypeOf<
      AsyncIterableIterator<CSVRecord<readonly string[]>>
    >();
  });
});

describe("csv literal ReadableStream parsing", () => {
  const csv1 = `name,age,city,zip
Alice,24,New York,10001
Bob,36,Los Angeles,90001`;

  const csv2 = "name,age,city,zip";

  it("should csv header of the parsed result will be header's tuple", () => {
    expectTypeOf(
      parseStringStream(new ReadableStream<typeof csv1>()),
    ).toEqualTypeOf<
      AsyncIterableIterator<CSVRecord<readonly ["name", "age", "city", "zip"]>>
    >();

    expectTypeOf(
      parseStringStream(new ReadableStream<typeof csv2>()),
    ).toEqualTypeOf<
      AsyncIterableIterator<CSVRecord<readonly ["name", "age", "city", "zip"]>>
    >();
  });
});

describe("csv literal ReadableStream parsing with line breaks, quotation, newline", () => {
  const csv1 = `"name","age
","city","zi
p"
Alice,24,New York,10001
Bob,36,Los Angeles,90001`;

  const csv2 = `'name'@'age
'@'city'@'zi
p'
Alice@24@New York@10001
Bob@36@Los Angeles@90001`;

  const csv3 = `'name'@'age

'@'c
ity'@'
zi
p'
Alice@'24'@'Ne
w York'@'10
001'
Bob@36@'Los Ange

les'@'9
0001'`;

  const csv4 = `'name'@'age

'@'c
ity'@'
zi
p'`;

  const csv5 = `'na${CR}me'@'age'@'ci${CR}${CRLF}ty'@'z${LF}ip'${CR}Alice@24@'New${CR}${LF} York'@10001${LF}Bob@'3${CRLF}6'@'Los Angeles'@'90${CRLF}001'`;

  it("should csv header of the parsed result will be header's tuple", () => {
    expectTypeOf(
      parseStringStream(new ReadableStream<typeof csv1>()),
    ).toEqualTypeOf<
      AsyncIterableIterator<
        CSVRecord<readonly ["name", "age\n", "city", "zi\np"]>
      >
    >();

    expectTypeOf(
      parseStringStream(new ReadableStream<typeof csv2>(), {
        delimiter: "@",
        quotation: "'",
      }),
    ).toEqualTypeOf<
      AsyncIterableIterator<
        CSVRecord<readonly ["name", "age\n", "city", "zi\np"]>
      >
    >();

    expectTypeOf(
      parseStringStream(new ReadableStream<typeof csv3>(), {
        delimiter: "@",
        quotation: "'",
      }),
    ).toEqualTypeOf<
      AsyncIterableIterator<
        CSVRecord<readonly ["name", "age\n\n", "c\nity", "\nzi\np"]>
      >
    >();

    expectTypeOf(
      parseStringStream(new ReadableStream<typeof csv4>(), {
        delimiter: "@",
        quotation: "'",
      }),
    ).toEqualTypeOf<
      AsyncIterableIterator<
        CSVRecord<readonly ["name", "age\n\n", "c\nity", "\nzi\np"]>
      >
    >();

    expectTypeOf(
      parseStringStream(new ReadableStream<typeof csv5>(), {
        delimiter: "@",
        quotation: "'",
      }),
    ).toEqualTypeOf<
      AsyncIterableIterator<
        CSVRecord<readonly ["na\rme", "age", "ci\r\r\nty", "z\nip"]>
      >
    >();
  });
});

describe("generics", () => {
  it("should CSV header of the parsed result should be the one specified in generics", () => {
    expectTypeOf(
      parseStringStream<readonly ["name", "age", "city", "zip"]>(
        {} as ReadableStream,
      ),
    ).toEqualTypeOf<
      AsyncIterableIterator<CSVRecord<readonly ["name", "age", "city", "zip"]>>
    >();

    expectTypeOf(
      parseStringStream<readonly ["name", "age", "city", "zip"]>(
        {} as ReadableStream<string>,
      ),
    ).toEqualTypeOf<
      AsyncIterableIterator<CSVRecord<readonly ["name", "age", "city", "zip"]>>
    >();

    expectTypeOf(
      parseStringStream<
        ReadableStream,
        readonly ["name", "age", "city", "zip"]
      >({} as ReadableStream),
    ).toEqualTypeOf<
      AsyncIterableIterator<CSVRecord<readonly ["name", "age", "city", "zip"]>>
    >();

    expectTypeOf(
      parseStringStream<
        ReadableStream<string>,
        readonly ["name", "age", "city", "zip"]
      >({} as ReadableStream<string>),
    ).toEqualTypeOf<
      AsyncIterableIterator<CSVRecord<readonly ["name", "age", "city", "zip"]>>
    >();

    expectTypeOf(
      parseStringStream<
        ReadableStream,
        "#",
        "$",
        readonly ["name", "age", "city", "zip"]
      >({} as ReadableStream, {
        delimiter: "#",
        quotation: "$",
      }),
    ).toEqualTypeOf<
      AsyncIterableIterator<CSVRecord<readonly ["name", "age", "city", "zip"]>>
    >();

    expectTypeOf(
      parseStringStream<
        ReadableStream<string>,
        "#",
        "$",
        readonly ["name", "age", "city", "zip"]
      >({} as ReadableStream<string>, {
        delimiter: "#",
        quotation: "$",
      }),
    ).toEqualTypeOf<
      AsyncIterableIterator<CSVRecord<readonly ["name", "age", "city", "zip"]>>
    >();
  });
});
