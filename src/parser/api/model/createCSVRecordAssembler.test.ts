import { describe, expect, test } from "vitest";
import { Delimiter } from "@/core/constants.ts";
import type { AnyToken } from "@/core/types.ts";
import { createCSVRecordAssembler } from "@/parser/api/model/createCSVRecordAssembler.ts";

describe("createCSVRecordAssembler", () => {
  const makeToken = (value: string): AnyToken => ({
    value,
    delimiter: Delimiter.Record,
    delimiterLength: 0,
  });

  test("returns object assembler by default", () => {
    const assembler = createCSVRecordAssembler({
      header: ["name"] as const,
    });
    expect(assembler).toHaveProperty("assemble");
    const records = [...assembler.assemble([makeToken("Alice")])];
    expect(records).toEqual([{ name: "Alice" }]);
  });

  test("returns array assembler when outputFormat is 'array'", () => {
    const assembler = createCSVRecordAssembler({
      header: [] as const,
      outputFormat: "array",
      columnCountStrategy: "keep",
    });
    const records = [...assembler.assemble([makeToken("Alice")])];
    expect(records).toEqual([["Alice"]]);
  });

  test("throws when headerless mode is not array format", () => {
    expect(() => {
      createCSVRecordAssembler({
        header: [] as const,
      });
    }).toThrow(/outputFormat: 'array'/);
  });

  test("throws when headerless mode uses non-keep strategy", () => {
    expect(() => {
      createCSVRecordAssembler({
        header: [] as const,
        outputFormat: "array",
        columnCountStrategy: "fill",
      });
    }).toThrow(/only supports columnCountStrategy: 'keep'/);
  });

  test("throws when includeHeader is used with non-array format", () => {
    expect(() => {
      createCSVRecordAssembler({
        header: ["name"] as const,
        includeHeader: true,
      } as any);
    }).toThrow(/includeHeader option is only valid for array format/);
  });

  test("throws when object uses sparse strategy", () => {
    expect(() => {
      createCSVRecordAssembler({
        header: ["name"] as const,
        columnCountStrategy: "sparse",
      });
    }).toThrow(/'sparse' is not allowed for object format/);
  });

  test("throws when object uses keep strategy", () => {
    expect(() => {
      createCSVRecordAssembler({
        header: ["name"] as const,
        columnCountStrategy: "keep",
      });
    }).toThrow(/'keep' is not allowed for object format/);
  });

  test("throws when object uses truncate strategy", () => {
    expect(() => {
      createCSVRecordAssembler({
        header: ["name"] as const,
        columnCountStrategy: "truncate",
      });
    }).toThrow(/'truncate' is not allowed for object format/);
  });
});
