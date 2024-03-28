import { describe, expectTypeOf, it } from "vitest";
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
  type Header = readonly string[];
  type Expected = AsyncIterableIterator<CSVRecord<Header>>;

  it("should CSV header of the parsed result will be string array", () => {
    const case1 = parse({} as CSVBinary);

    expectTypeOf(case1).toEqualTypeOf<Expected>();
  });
});

describe("string parsing", () => {
  type Header = readonly string[];
  type Expected = AsyncIterableIterator<CSVRecord<Header>>;

  it("should CSV header of the parsed result will be string array", () => {
    const case1 = parse("" as string);
    const case2 = parse({} as ReadableStream);
    const case3 = parse({} as ReadableStream<string>);
    const case4 = parse("" as CSVString);

    expectTypeOf(case1).toEqualTypeOf<Expected>();
    expectTypeOf(case2).toEqualTypeOf<Expected>();
    expectTypeOf(case3).toEqualTypeOf<Expected>();
    expectTypeOf(case4).toEqualTypeOf<Expected>();
  });
});

describe("csv literal string parsing", () => {
  type Header = readonly ["name", "age", "city", "zip"];
  type Expected = AsyncIterableIterator<CSVRecord<Header>>;

  const csv1 = `name,age,city,zip
Alice,24,New York,10001
Bob,36,Los Angeles,90001`;

  const stream1 = new ReadableStream<typeof csv1>();

  it("should csv header of the parsed result will be header's tuple", () => {
    const case1 = parse(csv1);
    const case2 = parse("" as CSVString<Header>);
    const case3 = parse("" as CSV<Header>);
    const case4 = parse(stream1);

    expectTypeOf(case1).toEqualTypeOf<Expected>();
    expectTypeOf(case2).toEqualTypeOf<Expected>();
    expectTypeOf(case3).toEqualTypeOf<Expected>();
    expectTypeOf(case4).toEqualTypeOf<Expected>();
  });
});

describe("csv literal string parsing with line breaks, quotation", () => {
  type Header = readonly ["name", "age\n", "city", "zi\np"];
  type Expected = AsyncIterableIterator<CSVRecord<Header>>;

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

  const stream1 = new ReadableStream<typeof csv1>();
  const stream2 = new ReadableStream<typeof csv2>();

  it("should csv header of the parsed result will be header's tuple", () => {
    const options = { delimiter: "@", quotation: "'" } as const;

    const case1 = parse(csv1);
    const case2 = parse(csv2, options);
    const case3 = parse("" as CSVString<Header>);
    const case4 = parse("" as CSV<Header>);
    const case5 = parse(stream1);
    const case6 = parse(stream2, options);

    expectTypeOf(case1).toEqualTypeOf<Expected>();
    expectTypeOf(case2).toEqualTypeOf<Expected>();
    expectTypeOf(case3).toEqualTypeOf<Expected>();
    expectTypeOf(case4).toEqualTypeOf<Expected>();
    expectTypeOf(case5).toEqualTypeOf<Expected>();
    expectTypeOf(case6).toEqualTypeOf<Expected>();
  });
});

describe("generics", () => {
  type Header = readonly ["name", "age", "city", "zip"];
  type Expected = AsyncIterableIterator<CSVRecord<Header>>;

  it("should CSV header of the parsed result should be the one specified in generics", () => {
    const options = {
      delimiter: "#",
      quotation: "$",
    } as const;

    const case1 = parse<Header>("");
    const case2 = parse<Header>({} as CSVBinary);
    const case3 = parse<Header>({} as ReadableStream);
    const case4 = parse<Header>({} as ReadableStream<string>);
    const case5 = parse<Header>("" as CSVString);
    const case6 = parse<string, Header>("");
    const case7 = parse<ReadableStream, Header>({} as ReadableStream);
    const case8 = parse<ReadableStream<string>, Header>(
      {} as ReadableStream<string>,
    );
    const case9 = parse<CSVString, Header>("" as CSVString);
    const case10 = parse<string, "#", "$", Header>("", options);
    const case11 = parse<ReadableStream, "#", "$", Header>(
      {} as ReadableStream,
      options,
    );
    const case12 = parse<ReadableStream<string>, "#", "$", Header>(
      {} as ReadableStream<string>,
      options,
    );
    const case13 = parse<CSVString, "#", "$", Header>("" as CSVString, options);

    expectTypeOf(case1).toEqualTypeOf<Expected>();
    expectTypeOf(case2).toEqualTypeOf<Expected>();
    expectTypeOf(case3).toEqualTypeOf<Expected>();
    expectTypeOf(case4).toEqualTypeOf<Expected>();
    expectTypeOf(case5).toEqualTypeOf<Expected>();
    expectTypeOf(case6).toEqualTypeOf<Expected>();
    expectTypeOf(case7).toEqualTypeOf<Expected>();
    expectTypeOf(case8).toEqualTypeOf<Expected>();
    expectTypeOf(case9).toEqualTypeOf<Expected>();
    expectTypeOf(case10).toEqualTypeOf<Expected>();
    expectTypeOf(case11).toEqualTypeOf<Expected>();
    expectTypeOf(case12).toEqualTypeOf<Expected>();
    expectTypeOf(case13).toEqualTypeOf<Expected>();
  });
});
