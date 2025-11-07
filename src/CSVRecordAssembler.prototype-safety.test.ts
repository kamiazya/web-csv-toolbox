import { describe, expect, test } from "vitest";
import { CSVLexer } from "./CSVLexer.js";
import { CSVRecordAssembler } from "./CSVRecordAssembler.js";

/**
 * Regression tests to ensure that CSVRecordAssembler does not cause prototype pollution.
 *
 * These tests verify that using dangerous property names like __proto__, constructor,
 * or prototype as CSV headers does NOT pollute Object.prototype or affect other objects.
 *
 * Context: Object.fromEntries() creates own properties, not prototype properties,
 * so it is safe from prototype pollution attacks.
 */
describe("CSVRecordAssembler - Prototype Pollution Safety (Regression)", () => {
  test("should not pollute Object.prototype when __proto__ is used as CSV header", () => {
    const lexer = new CSVLexer();
    const assembler = new CSVRecordAssembler();

    // CSV with __proto__ as a header
    const csv = "__proto__,name,age\r\nmalicious_value,Alice,30";

    const tokens = lexer.lex(csv);
    const records = [...assembler.assemble(tokens)];

    // Verify the record has __proto__ as its own property
    expect(records).toHaveLength(1);
    expect(records[0]).toHaveProperty("__proto__");
    expect(records[0].__proto__).toBe("malicious_value");
    expect(records[0].name).toBe("Alice");
    expect(records[0].age).toBe("30");

    // CRITICAL: Verify that Object.prototype was NOT polluted
    // If prototype pollution occurred, all new objects would have this property
    const testObject = {};
    expect(testObject).not.toHaveProperty("malicious_value");
    expect((testObject as any).malicious_value).toBeUndefined();

    // Verify __proto__ is an own property of the record, not inherited
    expect(Object.hasOwn(records[0], "__proto__")).toBe(true);
  });

  test("should not pollute when constructor is used as CSV header", () => {
    const lexer = new CSVLexer();
    const assembler = new CSVRecordAssembler();

    const csv = "constructor,name\r\nmalicious_value,Alice";

    const tokens = lexer.lex(csv);
    const records = [...assembler.assemble(tokens)];

    expect(records).toHaveLength(1);
    expect(records[0].constructor).toBe("malicious_value");
    expect(records[0].name).toBe("Alice");

    // Verify the constructor property is a string (own property), not the Function constructor
    expect(typeof records[0].constructor).toBe("string");

    // Verify constructor is an own property
    expect(Object.hasOwn(records[0], "constructor")).toBe(true);

    // Verify Object.constructor is not affected
    const testObject = {};
    expect(typeof testObject.constructor).toBe("function");
  });

  test("should not pollute when prototype is used as CSV header", () => {
    const lexer = new CSVLexer();
    const assembler = new CSVRecordAssembler();

    const csv = "prototype,name\r\nmalicious_value,Alice";

    const tokens = lexer.lex(csv);
    const records = [...assembler.assemble(tokens)];

    expect(records).toHaveLength(1);
    expect(records[0].prototype).toBe("malicious_value");
    expect(records[0].name).toBe("Alice");

    // Verify prototype is an own property
    expect(Object.hasOwn(records[0], "prototype")).toBe(true);
  });

  test("should handle multiple dangerous property names together", () => {
    const lexer = new CSVLexer();
    const assembler = new CSVRecordAssembler();

    // Multiple potentially dangerous headers in one CSV
    const csv =
      "__proto__,constructor,prototype,toString,valueOf,hasOwnProperty\r\nv1,v2,v3,v4,v5,v6";

    const tokens = lexer.lex(csv);
    const records = [...assembler.assemble(tokens)];

    expect(records).toHaveLength(1);
    const record = records[0];

    // All values should be strings (own properties)
    expect(record.__proto__).toBe("v1");
    expect(record.constructor).toBe("v2");
    expect(record.prototype).toBe("v3");
    expect(record.toString).toBe("v4");
    expect(record.valueOf).toBe("v5");
    expect(record.hasOwnProperty).toBe("v6");

    expect(typeof record.__proto__).toBe("string");
    expect(typeof record.constructor).toBe("string");
    expect(typeof record.prototype).toBe("string");
    expect(typeof record.toString).toBe("string");
    expect(typeof record.valueOf).toBe("string");
    expect(typeof record.hasOwnProperty).toBe("string");

    // Verify no prototype pollution occurred
    const testObject = {};
    expect((testObject as any).v1).toBeUndefined();
    expect((testObject as any).v2).toBeUndefined();
    expect((testObject as any).v3).toBeUndefined();
    expect((testObject as any).v4).not.toBe("v4"); // Should be the native function
    expect((testObject as any).v5).not.toBe("v5"); // Should be the native function
    expect((testObject as any).v6).not.toBe("v6"); // Should be the native function
  });

  test("should handle multiple records with __proto__ header without pollution", () => {
    const lexer = new CSVLexer();
    const assembler = new CSVRecordAssembler();

    const csv =
      "__proto__,name\r\nvalue1,Alice\r\nvalue2,Bob\r\nvalue3,Charlie";

    const tokens = lexer.lex(csv);
    const records = [...assembler.assemble(tokens)];

    expect(records).toHaveLength(3);

    // Each record should have its own __proto__ value
    expect(records[0].__proto__).toBe("value1");
    expect(records[1].__proto__).toBe("value2");
    expect(records[2].__proto__).toBe("value3");

    // Verify no global pollution after processing multiple records
    const testObject = {};
    expect((testObject as any).value1).toBeUndefined();
    expect((testObject as any).value2).toBeUndefined();
    expect((testObject as any).value3).toBeUndefined();
  });

  test("should verify Object.fromEntries behavior is safe (baseline test)", () => {
    // This test documents the safe behavior of Object.fromEntries()
    // which is used internally by CSVRecordAssembler

    const dangerousEntries: Array<[string, string]> = [
      ["__proto__", "polluted"],
      ["constructor", "malicious"],
      ["name", "test"],
    ];

    const obj = Object.fromEntries(dangerousEntries);

    // Verify properties are set as own properties
    expect(Object.hasOwn(obj, "__proto__")).toBe(true);
    expect(Object.hasOwn(obj, "constructor")).toBe(true);
    expect(obj.__proto__).toBe("polluted");
    expect(obj.constructor).toBe("malicious");

    // CRITICAL: Verify no prototype pollution occurred
    const testObject = {};
    expect((testObject as any).__proto__).not.toBe("polluted");
    expect((testObject as any).polluted).toBeUndefined();
    expect(typeof testObject.constructor).toBe("function"); // Should be the native Function constructor
  });

  test("should handle edge case with object-like notation in quoted values", () => {
    const lexer = new CSVLexer();
    const assembler = new CSVRecordAssembler();

    // Object-like syntax must be quoted to be treated as a single field
    const csv = '__proto__,name\r\n"{""polluted"":true}",Alice';

    const tokens = lexer.lex(csv);
    const records = [...assembler.assemble(tokens)];

    expect(records).toHaveLength(1);
    // The value should be treated as a plain string
    expect(records[0].__proto__).toBe('{"polluted":true}');
    expect(records[0].name).toBe("Alice");

    // Verify no pollution
    const testObject = {};
    expect((testObject as any).polluted).toBeUndefined();
  });

  test("should maintain safety with quoted fields containing dangerous names", () => {
    const lexer = new CSVLexer();
    const assembler = new CSVRecordAssembler();

    // Using quoted fields with dangerous property names
    const csv = '"__proto__","constructor"\r\n"evil1","evil2"';

    const tokens = lexer.lex(csv);
    const records = [...assembler.assemble(tokens)];

    expect(records).toHaveLength(1);
    expect(records[0].__proto__).toBe("evil1");
    expect(records[0].constructor).toBe("evil2");

    // Verify both are strings (own properties)
    expect(typeof records[0].__proto__).toBe("string");
    expect(typeof records[0].constructor).toBe("string");

    // Verify no pollution
    const testObject = {};
    expect((testObject as any).evil1).toBeUndefined();
    expect((testObject as any).evil2).toBeUndefined();
  });
});
