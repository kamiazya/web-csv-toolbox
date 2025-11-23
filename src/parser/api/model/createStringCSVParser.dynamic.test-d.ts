import { describe, test } from "vitest";
import type { CSVArrayRecord, CSVObjectRecord } from "@/core/types.ts";
import { createStringCSVParser } from "./createStringCSVParser.ts";

describe("createStringCSVParser with dynamic outputFormat", () => {
  test("should infer union type when outputFormat is dynamic", () => {
    const format: "object" | "array" = "object" as "object" | "array";
    const parser = createStringCSVParser({
      header: ["name", "age"] as const,
      outputFormat: format,
    });

    const result = parser.parse("Alice,30\n");
    for (const record of result) {
      // This compiles successfully if union type is correctly inferred
      const _test:
        | CSVObjectRecord<readonly ["name", "age"]>
        | CSVArrayRecord<readonly ["name", "age"]> = record;
      void _test; // Silence unused variable warning
      break;
    }
  });

  test("should infer object parser when outputFormat is 'object' literal", () => {
    const parser = createStringCSVParser({
      header: ["name", "age"] as const,
      outputFormat: "object",
    });

    const result = parser.parse("Alice,30\n");
    for (const record of result) {
      // This compiles successfully if object type is correctly inferred
      const name: string = record.name;
      const age: string = record.age;
      void name;
      void age;
      break;
    }
  });

  test("should infer array parser when outputFormat is 'array' literal", () => {
    const parser = createStringCSVParser({
      header: ["name", "age"] as const,
      outputFormat: "array",
    });

    const result = parser.parse("Alice,30\n");
    for (const record of result) {
      // This compiles successfully if array type is correctly inferred
      const first: string = record[0];
      const second: string = record[1];
      void first;
      void second;
      break;
    }
  });

  test("should infer object parser when outputFormat is omitted", () => {
    const parser = createStringCSVParser({
      header: ["name", "age"] as const,
    });

    const result = parser.parse("Alice,30\n");
    for (const record of result) {
      // Default should be object type
      const name: string = record.name;
      const age: string = record.age;
      void name;
      void age;
      break;
    }
  });

  test("should work with runtime format switching", () => {
    function getFormat(): "object" | "array" {
      return Math.random() > 0.5 ? "object" : "array";
    }

    const format = getFormat();
    const parser = createStringCSVParser({
      header: ["name", "age"] as const,
      outputFormat: format,
    });

    const result = parser.parse("Alice,30\n");
    for (const record of result) {
      // Union type allows both usages
      if ("name" in record) {
        const name: string = record.name;
        void name;
      } else {
        const first: string = record[0];
        void first;
      }
      break;
    }
  });
});
