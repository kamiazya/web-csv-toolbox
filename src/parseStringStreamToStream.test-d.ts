import { describe, expectTypeOf, it } from "vitest";
import { CR, CRLF, LF } from "./constants.ts";
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

  const csv2 = "name,age,city,zip";

  it("should csv header of the parsed result will be header's tuple", () => {
    expectTypeOf(
      parseStringStreamToStream(new ReadableStream<typeof csv1>()),
    ).toEqualTypeOf<
      ReadableStream<CSVRecord<readonly ["name", "age", "city", "zip"]>>
    >();

    expectTypeOf(
      parseStringStreamToStream(new ReadableStream<typeof csv2>()),
    ).toEqualTypeOf<
      ReadableStream<CSVRecord<readonly ["name", "age", "city", "zip"]>>
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

  const csv6 = `'@name'@'age

'@'c
@ity@'@'
zi
p'
'Alice@'@'24'@'@Ne
w York'@'10
00@1'
Bob@36@'Lo@s Ange

les'@'@9
0001'`;

  const csv7 = `'@name'@'a'g'e

'@'c
@i''ty@'@'
'zi
p''
'Al'ic'e@'@''24''@'@Ne
w Yo'r'k'@'10
00@1'
'Bob'@36@'Lo@s A'nge'

les'@'@9
0001'''`;

  it("should csv header of the parsed result will be header's tuple", () => {
    expectTypeOf(
      parseStringStreamToStream(new ReadableStream<typeof csv1>()),
    ).toEqualTypeOf<
      ReadableStream<CSVRecord<readonly ["name", "age\n", "city", "zi\np"]>>
    >();

    expectTypeOf(
      parseStringStreamToStream(new ReadableStream<typeof csv2>(), {
        delimiter: "@",
        quotation: "'",
      }),
    ).toEqualTypeOf<
      ReadableStream<CSVRecord<readonly ["name", "age\n", "city", "zi\np"]>>
    >();

    expectTypeOf(
      parseStringStreamToStream(new ReadableStream<typeof csv3>(), {
        delimiter: "@",
        quotation: "'",
      }),
    ).toEqualTypeOf<
      ReadableStream<
        CSVRecord<readonly ["name", "age\n\n", "c\nity", "\nzi\np"]>
      >
    >();

    expectTypeOf(
      parseStringStreamToStream(new ReadableStream<typeof csv4>(), {
        delimiter: "@",
        quotation: "'",
      }),
    ).toEqualTypeOf<
      ReadableStream<
        CSVRecord<readonly ["name", "age\n\n", "c\nity", "\nzi\np"]>
      >
    >();

    expectTypeOf(
      parseStringStreamToStream(new ReadableStream<typeof csv5>(), {
        delimiter: "@",
        quotation: "'",
      }),
    ).toEqualTypeOf<
      ReadableStream<
        CSVRecord<readonly ["na\rme", "age", "ci\r\r\nty", "z\nip"]>
      >
    >();

    expectTypeOf(
      parseStringStreamToStream(new ReadableStream<typeof csv6>(), {
        delimiter: "@",
        quotation: "'",
      }),
    ).toEqualTypeOf<
      ReadableStream<
        CSVRecord<readonly ["@name", "age\n\n", "c\n@ity@", "\nzi\np"]>
      >
    >();

    expectTypeOf(
      parseStringStreamToStream(new ReadableStream<typeof csv7>(), {
        delimiter: "@",
        quotation: "'",
      }),
    ).toEqualTypeOf<
      ReadableStream<
        CSVRecord<readonly ["@name", "a'g'e\n\n", "c\n@i''ty@", "\n'zi\np'"]>
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
