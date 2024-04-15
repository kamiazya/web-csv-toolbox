import { describe, expectTypeOf, it } from "vitest";
import { CR, CRLF, LF } from "./constants.ts";
import { parseStringToArraySyncWASM } from "./parseStringToArraySyncWASM.ts";
import type { CSVRecord, ParseOptions } from "./web-csv-toolbox.ts";

describe("parseStringToArraySyncWASM function", () => {
  it("parseStringToArraySyncWASM should be a function with expected parameter types", () => {
    expectTypeOf(parseStringToArraySyncWASM).toBeFunction();
    expectTypeOf(parseStringToArraySyncWASM)
      .parameter(0)
      .toMatchTypeOf<string>();
    expectTypeOf(parseStringToArraySyncWASM)
      .parameter(1)
      .toMatchTypeOf<ParseOptions<readonly string[]> | undefined>();
  });
});

describe("string parsing", () => {
  it("should CSV header of the parsed result will be string array", () => {
    expectTypeOf(parseStringToArraySyncWASM("" as string)).toEqualTypeOf<
      CSVRecord<readonly string[]>[]
    >();
  });
});

describe("csv literal string parsing", () => {
  const csv1 = `name,age,city,zip
Alice,24,New York,10001
Bob,36,Los Angeles,90001`;

  const csv2 = "name,age,city,zip";

  it("should csv header of the parsed result will be header's tuple", () => {
    expectTypeOf(parseStringToArraySyncWASM(csv1)).toMatchTypeOf<
      [
        {
          name: "Alice";
          age: "24";
          city: "New York";
          zip: "10001";
        },
        {
          name: "Bob";
          age: "36";
          city: "Los Angeles";
          zip: "90001";
        },
      ]
    >();

    expectTypeOf(parseStringToArraySyncWASM(csv2)).toMatchTypeOf<
      CSVRecord<["name", "age", "city", "zip"]>[]
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
    expectTypeOf(parseStringToArraySyncWASM(csv1)).toMatchTypeOf<
      [
        {
          name: "Alice";
          "age\n": "24";
          city: "New York";
          "zi\np": "10001";
        },
        {
          name: "Bob";
          "age\n": "36";
          city: "Los Angeles";
          "zi\np": "90001";
        },
      ]
    >();

    expectTypeOf(
      parseStringToArraySyncWASM(csv2, { delimiter: "@", quotation: "'" }),
    ).toMatchTypeOf<
      [
        {
          name: "Alice";
          "age\n": "24";
          city: "New York";
          "zi\np": "10001";
        },
        {
          name: "Bob";
          "age\n": "36";
          city: "Los Angeles";
          "zi\np": "90001";
        },
      ]
    >();

    expectTypeOf(
      parseStringToArraySyncWASM(csv3, { delimiter: "@", quotation: "'" }),
    ).toMatchTypeOf<
      [
        {
          name: "Alice";
          "age\n\n": "24";
          "c\nity": "Ne\nw York";
          "\nzi\np": "10\n001";
        },
        {
          name: "Bob";
          "age\n\n": "36";
          "c\nity": "Los Ange\n\nles";
          "\nzi\np": "9\n0001";
        },
      ]
    >();

    expectTypeOf(
      parseStringToArraySyncWASM(csv4, { delimiter: "@", quotation: "'" }),
    ).toEqualTypeOf<CSVRecord<["name", "age\n\n", "c\nity", "\nzi\np"]>[]>();

    expectTypeOf(
      parseStringToArraySyncWASM(csv5, { delimiter: "@", quotation: "'" }),
    ).toMatchTypeOf<
      [
        {
          "na\rme": "Alice";
          age: "24";
          "ci\r\r\nty": "New\r\n York";
          "z\nip": "10001";
        },
        {
          "na\rme": "Bob";
          age: "3\r\n6";
          "ci\r\r\nty": "Los Angeles";
          "z\nip": "90\r\n001";
        },
      ]
    >();
  });
});

describe("generics", () => {
  it("should CSV header of the parsed result should be the one specified in generics", () => {
    expectTypeOf(
      parseStringToArraySyncWASM<readonly ["name", "age", "city", "zip"]>(""),
    ).toEqualTypeOf<CSVRecord<readonly ["name", "age", "city", "zip"]>[]>();

    expectTypeOf(
      parseStringToArraySyncWASM<
        string,
        readonly ["name", "age", "city", "zip"]
      >(""),
    ).toEqualTypeOf<CSVRecord<readonly ["name", "age", "city", "zip"]>[]>();

    expectTypeOf(
      parseStringToArraySyncWASM<
        string,
        "#",
        "$",
        readonly ["name", "age", "city", "zip"]
      >("", {
        delimiter: "#",
        quotation: "$",
      }),
    ).toEqualTypeOf<CSVRecord<readonly ["name", "age", "city", "zip"]>[]>();
  });
});
