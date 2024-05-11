import { describe, expectTypeOf, it } from "vitest";
import { CR, CRLF, LF } from "./constants.ts";
import { parse } from "./parse.ts";
import type {
  CSV,
  CSVBinary,
  CSVRecord,
  CSVString,
  ParseOptions,
} from "./web-csv-toolbox.ts";

describe("parse function", () => {
  it("parse should be a function with expected parameter types", () => {
    expectTypeOf(parse).toBeFunction();
    expectTypeOf(parse).parameter(0).toMatchTypeOf<CSV>();
    expectTypeOf(parse)
      .parameter(1)
      .toMatchTypeOf<ParseOptions<readonly string[]> | undefined>();
  });
});

describe("binary parsing", () => {
  it("should CSV header of the parsed result will be string array", () => {
    expectTypeOf(parse({} as CSVBinary)).toEqualTypeOf<
      AsyncIterableIterator<CSVRecord<readonly string[]>>
    >();
  });
});

describe("string parsing", () => {
  it("should CSV header of the parsed result will be string array", () => {
    expectTypeOf(parse("" as string)).toEqualTypeOf<
      AsyncIterableIterator<CSVRecord<readonly string[]>>
    >();

    expectTypeOf(parse({} as ReadableStream)).toEqualTypeOf<
      AsyncIterableIterator<CSVRecord<readonly string[]>>
    >();

    expectTypeOf(parse({} as ReadableStream<string>)).toEqualTypeOf<
      AsyncIterableIterator<CSVRecord<readonly string[]>>
    >();

    expectTypeOf(parse("" as CSVString)).toEqualTypeOf<
      AsyncIterableIterator<CSVRecord<readonly string[]>>
    >();
  });
});

describe("csv literal string parsing", () => {
  const csv1 = `name,age,city,zip
Alice,24,New York,10001
Bob,36,Los Angeles,90001`;

  const csv2 = "name,age,city,zip";

  it("should csv header of the parsed result will be header's tuple", () => {
    expectTypeOf(parse(csv1)).toEqualTypeOf<
      AsyncIterableIterator<CSVRecord<readonly ["name", "age", "city", "zip"]>>
    >();

    expectTypeOf(parse(csv2)).toEqualTypeOf<
      AsyncIterableIterator<CSVRecord<readonly ["name", "age", "city", "zip"]>>
    >();

    expectTypeOf(
      parse("" as CSVString<readonly ["name", "age", "city", "zip"]>),
    ).toEqualTypeOf<
      AsyncIterableIterator<CSVRecord<readonly ["name", "age", "city", "zip"]>>
    >();

    expectTypeOf(
      parse("" as CSV<readonly ["name", "age", "city", "zip"]>),
    ).toEqualTypeOf<
      AsyncIterableIterator<CSVRecord<readonly ["name", "age", "city", "zip"]>>
    >();

    expectTypeOf(parse(new ReadableStream<typeof csv1>())).toEqualTypeOf<
      AsyncIterableIterator<CSVRecord<readonly ["name", "age", "city", "zip"]>>
    >();
  });
});

describe("csv literal string parsing with line breaks, quotation, newline", () => {
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
    expectTypeOf(parse(csv1)).toEqualTypeOf<
      AsyncIterableIterator<
        CSVRecord<readonly ["name", "age\n", "city", "zi\np"]>
      >
    >();

    expectTypeOf(parse(csv2, { delimiter: "@", quotation: "'" })).toEqualTypeOf<
      AsyncIterableIterator<
        CSVRecord<readonly ["name", "age\n", "city", "zi\np"]>
      >
    >();

    expectTypeOf(parse(csv3, { delimiter: "@", quotation: "'" })).toEqualTypeOf<
      AsyncIterableIterator<
        CSVRecord<readonly ["name", "age\n\n", "c\nity", "\nzi\np"]>
      >
    >();

    expectTypeOf(parse(csv4, { delimiter: "@", quotation: "'" })).toEqualTypeOf<
      AsyncIterableIterator<
        CSVRecord<readonly ["name", "age\n\n", "c\nity", "\nzi\np"]>
      >
    >();

    expectTypeOf(parse(csv5, { delimiter: "@", quotation: "'" })).toEqualTypeOf<
      AsyncIterableIterator<
        CSVRecord<readonly ["na\rme", "age", "ci\r\r\nty", "z\nip"]>
      >
    >();

    expectTypeOf(parse(csv6, { delimiter: "@", quotation: "'" })).toEqualTypeOf<
      AsyncIterableIterator<
        CSVRecord<readonly ["@name", "age\n\n", "c\n@ity@", "\nzi\np"]>
      >
    >();

    expectTypeOf(parse(csv7, { delimiter: "@", quotation: "'" })).toEqualTypeOf<
      AsyncIterableIterator<
        CSVRecord<readonly ["@name", "a'g'e\n\n", "c\n@i''ty@", "\n'zi\np'"]>
      >
    >();

    expectTypeOf(
      parse("" as CSVString<readonly ["name", "age\n", "city", "zi\np"]>),
    ).toEqualTypeOf<
      AsyncIterableIterator<
        CSVRecord<readonly ["name", "age\n", "city", "zi\np"]>
      >
    >();

    expectTypeOf(
      parse("" as CSV<readonly ["name", "age\n", "city", "zi\np"]>),
    ).toEqualTypeOf<
      AsyncIterableIterator<
        CSVRecord<readonly ["name", "age\n", "city", "zi\np"]>
      >
    >();

    expectTypeOf(parse(new ReadableStream<typeof csv1>())).toEqualTypeOf<
      AsyncIterableIterator<
        CSVRecord<readonly ["name", "age\n", "city", "zi\np"]>
      >
    >();

    expectTypeOf(
      parse(new ReadableStream<typeof csv2>(), {
        delimiter: "@",
        quotation: "'",
      }),
    ).toEqualTypeOf<
      AsyncIterableIterator<
        CSVRecord<readonly ["name", "age\n", "city", "zi\np"]>
      >
    >();

    expectTypeOf(
      parse(new ReadableStream<typeof csv3>(), {
        delimiter: "@",
        quotation: "'",
      }),
    ).toEqualTypeOf<
      AsyncIterableIterator<
        CSVRecord<readonly ["name", "age\n\n", "c\nity", "\nzi\np"]>
      >
    >();

    expectTypeOf(
      parse(new ReadableStream<typeof csv4>(), {
        delimiter: "@",
        quotation: "'",
      }),
    ).toEqualTypeOf<
      AsyncIterableIterator<
        CSVRecord<readonly ["name", "age\n\n", "c\nity", "\nzi\np"]>
      >
    >();

    expectTypeOf(
      parse(new ReadableStream<typeof csv5>(), {
        delimiter: "@",
        quotation: "'",
      }),
    ).toEqualTypeOf<
      AsyncIterableIterator<
        CSVRecord<readonly ["na\rme", "age", "ci\r\r\nty", "z\nip"]>
      >
    >();

    expectTypeOf(
      parse(new ReadableStream<typeof csv6>(), {
        delimiter: "@",
        quotation: "'",
      }),
    ).toEqualTypeOf<
      AsyncIterableIterator<
        CSVRecord<readonly ["@name", "age\n\n", "c\n@ity@", "\nzi\np"]>
      >
    >();
  });
});

describe("generics", () => {
  it("should CSV header of the parsed result should be the one specified in generics", () => {
    expectTypeOf(
      parse<readonly ["name", "age", "city", "zip"]>(""),
    ).toEqualTypeOf<
      AsyncIterableIterator<CSVRecord<readonly ["name", "age", "city", "zip"]>>
    >();

    expectTypeOf(
      parse<readonly ["name", "age", "city", "zip"]>({} as CSVBinary),
    ).toEqualTypeOf<
      AsyncIterableIterator<CSVRecord<readonly ["name", "age", "city", "zip"]>>
    >();

    expectTypeOf(
      parse<readonly ["name", "age", "city", "zip"]>({} as ReadableStream),
    ).toEqualTypeOf<
      AsyncIterableIterator<CSVRecord<readonly ["name", "age", "city", "zip"]>>
    >();

    expectTypeOf(
      parse<readonly ["name", "age", "city", "zip"]>(
        {} as ReadableStream<string>,
      ),
    ).toEqualTypeOf<
      AsyncIterableIterator<CSVRecord<readonly ["name", "age", "city", "zip"]>>
    >();

    expectTypeOf(
      parse<readonly ["name", "age", "city", "zip"]>("" as CSVString),
    ).toEqualTypeOf<
      AsyncIterableIterator<CSVRecord<readonly ["name", "age", "city", "zip"]>>
    >();

    expectTypeOf(
      parse<string, readonly ["name", "age", "city", "zip"]>(""),
    ).toEqualTypeOf<
      AsyncIterableIterator<CSVRecord<readonly ["name", "age", "city", "zip"]>>
    >();

    expectTypeOf(
      parse<ReadableStream, readonly ["name", "age", "city", "zip"]>(
        {} as ReadableStream,
      ),
    ).toEqualTypeOf<
      AsyncIterableIterator<CSVRecord<readonly ["name", "age", "city", "zip"]>>
    >();

    expectTypeOf(
      parse<ReadableStream<string>, readonly ["name", "age", "city", "zip"]>(
        {} as ReadableStream<string>,
      ),
    ).toEqualTypeOf<
      AsyncIterableIterator<CSVRecord<readonly ["name", "age", "city", "zip"]>>
    >();

    expectTypeOf(
      parse<CSVString, readonly ["name", "age", "city", "zip"]>(
        "" as CSVString,
      ),
    ).toEqualTypeOf<
      AsyncIterableIterator<CSVRecord<readonly ["name", "age", "city", "zip"]>>
    >();

    expectTypeOf(
      parse<string, "#", "$", readonly ["name", "age", "city", "zip"]>("", {
        delimiter: "#",
        quotation: "$",
      }),
    ).toEqualTypeOf<
      AsyncIterableIterator<CSVRecord<readonly ["name", "age", "city", "zip"]>>
    >();

    expectTypeOf(
      parse<ReadableStream, "#", "$", readonly ["name", "age", "city", "zip"]>(
        {} as ReadableStream,
        {
          delimiter: "#",
          quotation: "$",
        },
      ),
    ).toEqualTypeOf<
      AsyncIterableIterator<CSVRecord<readonly ["name", "age", "city", "zip"]>>
    >();

    expectTypeOf(
      parse<
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

    expectTypeOf(
      parse<CSVString, "#", "$", readonly ["name", "age", "city", "zip"]>(
        "" as CSVString,
        {
          delimiter: "#",
          quotation: "$",
        },
      ),
    ).toEqualTypeOf<
      AsyncIterableIterator<CSVRecord<readonly ["name", "age", "city", "zip"]>>
    >();
  });
});
