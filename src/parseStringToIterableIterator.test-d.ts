import { describe, expectTypeOf, it } from "vitest";
import { CR, CRLF, LF } from "./constants.ts";
import { parseStringToIterableIterator } from "./parseStringToIterableIterator.ts";
import type { CSVRecord, ParseOptions } from "./web-csv-toolbox.ts";

describe("parseStringToIterableIterator function", () => {
  it("parseStringToIterableIterator should be a function with expected parameter types", () => {
    expectTypeOf(parseStringToIterableIterator).toBeFunction();
    expectTypeOf(parseStringToIterableIterator)
      .parameter(0)
      .toMatchTypeOf<string>();
    expectTypeOf(parseStringToIterableIterator)
      .parameter(1)
      .toMatchTypeOf<ParseOptions<readonly string[]> | undefined>();
  });
});

describe("string parsing", () => {
  it("should CSV header of the parsed result will be string array", () => {
    expectTypeOf(parseStringToIterableIterator("" as string)).toEqualTypeOf<
      IterableIterator<CSVRecord<readonly string[]>>
    >();
  });
});

describe("csv literal string parsing", () => {
  const csv1 = `name,age,city,zip
Alice,24,New York,10001
Bob,36,Los Angeles,90001`;

  const csv2 = "name,age,city,zip";

  it("should csv header of the parsed result will be header's tuple", () => {
    expectTypeOf(parseStringToIterableIterator(csv1)).toEqualTypeOf<
      IterableIterator<CSVRecord<readonly ["name", "age", "city", "zip"]>>
    >();

    expectTypeOf(parseStringToIterableIterator(csv2)).toEqualTypeOf<
      IterableIterator<CSVRecord<readonly ["name", "age", "city", "zip"]>>
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

  it("should csv header of the parsed result will be header's tuple", () => {
    expectTypeOf(parseStringToIterableIterator(csv1)).toEqualTypeOf<
      IterableIterator<CSVRecord<readonly ["name", "age\n", "city", "zi\np"]>>
    >();

    expectTypeOf(
      parseStringToIterableIterator(csv2, { delimiter: "@", quotation: "'" }),
    ).toEqualTypeOf<
      IterableIterator<CSVRecord<readonly ["name", "age\n", "city", "zi\np"]>>
    >();

    expectTypeOf(
      parseStringToIterableIterator(csv3, { delimiter: "@", quotation: "'" }),
    ).toEqualTypeOf<
      IterableIterator<
        CSVRecord<readonly ["name", "age\n\n", "c\nity", "\nzi\np"]>
      >
    >();

    expectTypeOf(
      parseStringToIterableIterator(csv4, { delimiter: "@", quotation: "'" }),
    ).toEqualTypeOf<
      IterableIterator<
        CSVRecord<readonly ["name", "age\n\n", "c\nity", "\nzi\np"]>
      >
    >();

    expectTypeOf(
      parseStringToIterableIterator(csv5, { delimiter: "@", quotation: "'" }),
    ).toEqualTypeOf<
      IterableIterator<
        CSVRecord<readonly ["na\rme", "age", "ci\r\r\nty", "z\nip"]>
      >
    >();

    expectTypeOf(
      parseStringToIterableIterator(csv6, { delimiter: "@", quotation: "'" }),
    ).toEqualTypeOf<
      IterableIterator<
        CSVRecord<readonly ["@name", "age\n\n", "c\n@ity@", "\nzi\np"]>
      >
    >();
  });
});

describe("generics", () => {
  it("should CSV header of the parsed result should be the one specified in generics", () => {
    expectTypeOf(
      parseStringToIterableIterator<readonly ["name", "age", "city", "zip"]>(
        "",
      ),
    ).toEqualTypeOf<
      IterableIterator<CSVRecord<readonly ["name", "age", "city", "zip"]>>
    >();

    expectTypeOf(
      parseStringToIterableIterator<
        string,
        readonly ["name", "age", "city", "zip"]
      >(""),
    ).toEqualTypeOf<
      IterableIterator<CSVRecord<readonly ["name", "age", "city", "zip"]>>
    >();

    expectTypeOf(
      parseStringToIterableIterator<
        string,
        "#",
        "$",
        readonly ["name", "age", "city", "zip"]
      >("", {
        delimiter: "#",
        quotation: "$",
      }),
    ).toEqualTypeOf<
      IterableIterator<CSVRecord<readonly ["name", "age", "city", "zip"]>>
    >();
  });
});
