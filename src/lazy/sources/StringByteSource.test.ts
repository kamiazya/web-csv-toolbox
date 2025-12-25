import { describe, expect, test } from "vitest";
import { StringByteSource, createStringByteSource } from "./StringByteSource.js";

describe("StringByteSource", () => {
	test("should create from string", () => {
		const csv = "name,age\nAlice,30";
		using source = createStringByteSource(csv);

		expect(source).toBeInstanceOf(StringByteSource);
	});

	test("should return identity", () => {
		const csv = "name,age\nAlice,30";
		using source = createStringByteSource(csv);

		const identity = source.identity();

		expect(identity).toBeDefined();
		expect(identity.id).toContain("string:");
		expect(identity.size).toBe(BigInt(new TextEncoder().encode(csv).byteLength));
	});

	test("should read bytes synchronously", () => {
		const csv = "name,age\nAlice,30";
		using source = createStringByteSource(csv);

		const bytes = source.readSync(0, 10);

		expect(bytes).toBeInstanceOf(Uint8Array);
		expect(bytes.byteLength).toBe(10);

		const decoder = new TextDecoder();
		const text = decoder.decode(bytes);
		expect(text).toBe("name,age\nA");
	});

	test("should read all bytes", () => {
		const csv = "name,age\nAlice,30";
		using source = createStringByteSource(csv);

		const bytes = source.readSync(0, 1000); // more than actual size

		const decoder = new TextDecoder();
		const text = decoder.decode(bytes);
		expect(text).toBe(csv);
	});

	test("should read bytes from offset", () => {
		const csv = "name,age\nAlice,30";
		using source = createStringByteSource(csv);

		const bytes = source.readSync(5, 5);

		const decoder = new TextDecoder();
		const text = decoder.decode(bytes);
		expect(text).toBe("age\nA");
	});

	test("should return empty array when offset is out of bounds", () => {
		const csv = "name,age\nAlice,30";
		using source = createStringByteSource(csv);

		const bytes = source.readSync(1000, 10);

		expect(bytes).toBeInstanceOf(Uint8Array);
		expect(bytes.byteLength).toBe(0);
	});

	test("should dispose", () => {
		const csv = "name,age\nAlice,30";
		const source = createStringByteSource(csv);

		source[Symbol.dispose]();

		// Should not throw
	});
});
