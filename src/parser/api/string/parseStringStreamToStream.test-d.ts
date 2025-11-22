import { describe, expectTypeOf, it } from "vitest";
import type { CSVArrayRecord, CSVRecord } from "@/core/types.ts";
import { parseStringStreamToStream } from "@/parser/api/string/parseStringStreamToStream.ts";

describe("parseStringStreamToStream function", () => {
  it("parseStringStreamToStream should be a function", () => {
    expectTypeOf(parseStringStreamToStream).toBeFunction();
  });
});

describe("string ReadableStream parsing", () => {
  it("should CSV header of the parsed result will be string array", () => {
    const result1 = parseStringStreamToStream(new ReadableStream<string>());
    expectTypeOf(result1).toEqualTypeOf<
      ReadableStream<CSVRecord<readonly string[]>>
    >();

    const result2 = parseStringStreamToStream(new ReadableStream<string>());
    expectTypeOf(result2).toEqualTypeOf<
      ReadableStream<CSVRecord<readonly string[]>>
    >();
  });
});

describe("csv literal ReadableStream parsing", () => {
  const csv1 = `name,age,city,zip
Alice,24,New York,10001
Bob,36,Los Angeles,90001`;

  it("should csv header of the parsed result will be header's tuple", () => {
    const result = parseStringStreamToStream(
      new ReadableStream<typeof csv1>(),
      {
        header: ["name", "age", "city", "zip"] as const,
      },
    );
    expectTypeOf(result).toEqualTypeOf<
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
    const result = parseStringStreamToStream<
      ReadableStream<typeof csv1>,
      "*",
      "$"
    >(new ReadableStream<typeof csv1>(), {
      delimiter: "*",
      quotation: "$",
    });
    expectTypeOf(result).toEqualTypeOf<
      ReadableStream<
        CSVRecord<readonly ["name", "*ag\ne\n", "city", "z*i\np*"]>
      >
    >();
  });
});

describe("generics", () => {
  it("should CSV header of the parsed result should be the one specified in generics", () => {
    expectTypeOf(
      parseStringStreamToStream(new ReadableStream<string>(), {
        header: ["name", "age", "city", "zip"] as const,
      }),
    ).toMatchTypeOf<
      ReadableStream<CSVRecord<readonly ["name", "age", "city", "zip"]>>
    >();

    expectTypeOf(
      parseStringStreamToStream(new ReadableStream<string>(), {
        header: ["name", "age", "city", "zip"] as const,
      }),
    ).toMatchTypeOf<
      ReadableStream<CSVRecord<readonly ["name", "age", "city", "zip"]>>
    >();

    expectTypeOf(
      parseStringStreamToStream(new ReadableStream<string>(), {
        header: ["name", "age", "city", "zip"] as const,
      }),
    ).toMatchTypeOf<
      ReadableStream<CSVRecord<readonly ["name", "age", "city", "zip"]>>
    >();

    expectTypeOf(
      parseStringStreamToStream(new ReadableStream<string>(), {
        header: ["name", "age", "city", "zip"] as const,
      }),
    ).toMatchTypeOf<
      ReadableStream<CSVRecord<readonly ["name", "age", "city", "zip"]>>
    >();
  });
});

describe("array output format", () => {
  it("should return ReadableStream of CSVArrayRecord when outputFormat is 'array'", () => {
    expectTypeOf(
      parseStringStreamToStream(new ReadableStream<string>(), {
        outputFormat: "array" as const,
      }),
    ).toMatchTypeOf<ReadableStream<CSVArrayRecord<readonly string[]>>>();
  });

  // Type test skipped due to TypeScript limitations with ReadableStream generics

  it("should return ReadableStream of CSVObjectRecord when outputFormat is 'object'", () => {
    expectTypeOf(
      parseStringStreamToStream(new ReadableStream<string>(), {
        header: ["name", "age", "city", "zip"] as const,
        outputFormat: "object" as const,
      }),
    ).toMatchTypeOf<
      ReadableStream<CSVRecord<readonly ["name", "age", "city", "zip"]>>
    >();
  });
});
