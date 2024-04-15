import { describe, expectTypeOf, it } from "vitest";
import { CR, CRLF, LF } from "./constants.ts";
import { parseStringToStream } from "./parseStringToStream.ts";
import type { CSVRecord, ParseOptions } from "./web-csv-toolbox.ts";

describe("parseStringToStream function", () => {
  it("parseStringToStream should be a function with expected parameter types", () => {
    expectTypeOf(parseStringToStream).toBeFunction();
    expectTypeOf(parseStringToStream).parameter(0).toMatchTypeOf<string>();
    expectTypeOf(parseStringToStream)
      .parameter(1)
      .toMatchTypeOf<ParseOptions<readonly string[]> | undefined>();
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

  const csv2 = "name,age,city,zip";

  it("should csv header of the parsed result will be header's tuple", () => {
    expectTypeOf(parseStringToStream(csv1)).toEqualTypeOf<
      ReadableStream<CSVRecord<readonly ["name", "age", "city", "zip"]>>
    >();

    expectTypeOf(parseStringToStream(csv2)).toEqualTypeOf<
      ReadableStream<CSVRecord<readonly ["name", "age", "city", "zip"]>>
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

  it("should csv header of the parsed result will be header's tuple", () => {
    expectTypeOf(parseStringToStream(csv1)).toEqualTypeOf<
      ReadableStream<CSVRecord<readonly ["name", "age\n", "city", "zi\np"]>>
    >();

    expectTypeOf(
      parseStringToStream(csv2, { delimiter: "@", quotation: "'" }),
    ).toEqualTypeOf<
      ReadableStream<CSVRecord<readonly ["name", "age\n", "city", "zi\np"]>>
    >();

    expectTypeOf(
      parseStringToStream(csv3, { delimiter: "@", quotation: "'" }),
    ).toEqualTypeOf<
      ReadableStream<
        CSVRecord<readonly ["name", "age\n\n", "c\nity", "\nzi\np"]>
      >
    >();

    expectTypeOf(
      parseStringToStream(csv4, { delimiter: "@", quotation: "'" }),
    ).toEqualTypeOf<
      ReadableStream<
        CSVRecord<readonly ["name", "age\n\n", "c\nity", "\nzi\np"]>
      >
    >();

    expectTypeOf(
      parseStringToStream(csv5, { delimiter: "@", quotation: "'" }),
    ).toEqualTypeOf<
      ReadableStream<
        CSVRecord<readonly ["na\rme", "age", "ci\r\r\nty", "z\nip"]>
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
