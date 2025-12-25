import { beforeEach, describe, expect, test } from "vitest";
import { CsvStoreImpl, createCsvStore } from "./CsvStore.js";
import { createJavaScriptIndexBackend } from "./backends/JavaScriptIndexBackend.js";
import { createBlobByteSource } from "./sources/BlobByteSource.js";
import { createStringByteSource } from "./sources/StringByteSource.js";
import { createMemoryIndexStore } from "./stores/MemoryIndexStore.js";
import type { Limits } from "./types.js";

describe("CsvStore", () => {
	const testLimits: Limits = {
		maxFieldBytes: 1024 * 1024,
		maxRecordBytes: 10 * 1024 * 1024,
		maxFieldsPerRecord: 1000,
	};

	describe("Basic functionality", () => {
		test("should create CsvStore from string", async () => {
			const csv = "name,age\nAlice,30\nBob,25";

			await using store = await createCsvStore({
				source: createStringByteSource(csv),
				backend: createJavaScriptIndexBackend(),
				indexStore: createMemoryIndexStore(),
				limits: testLimits,
			});

			expect(store).toBeInstanceOf(CsvStoreImpl);
		});

		test("should build index", async () => {
			const csv = "name,age\nAlice,30\nBob,25";

			await using store = await createCsvStore({
				source: createStringByteSource(csv),
				backend: createJavaScriptIndexBackend(),
				indexStore: createMemoryIndexStore(),
				limits: testLimits,
			});

			await store.buildIndex();

			// identity should be available after buildIndex
			const identity = store.identity;
			expect(identity).toBeDefined();
			expect(identity.id).toContain("string:");
		});

		test("should get cell value", async () => {
			const csv = "name,age\nAlice,30\nBob,25";

			await using store = await createCsvStore({
				source: createStringByteSource(csv),
				backend: createJavaScriptIndexBackend(),
				indexStore: createMemoryIndexStore(),
				limits: testLimits,
			});

			await store.buildIndex();

			const cell00 = await store.getCell(0, 0);
			const cell01 = await store.getCell(0, 1);
			const cell10 = await store.getCell(1, 0);
			const cell11 = await store.getCell(1, 1);

			expect(cell00).toBe("name");
			expect(cell01).toBe("age");
			expect(cell10).toBe("Alice");
			expect(cell11).toBe("30");
		});
	});

	describe("Blob source", () => {
		test("should work with Blob", async () => {
			const csv = "name,age\nAlice,30\nBob,25";
			const blob = new Blob([csv], { type: "text/csv" });

			await using store = await createCsvStore({
				source: createBlobByteSource(blob),
				backend: createJavaScriptIndexBackend(),
				indexStore: createMemoryIndexStore(),
				limits: testLimits,
			});

			await store.buildIndex();

			const cell = await store.getCell(1, 0);
			expect(cell).toBe("Alice");
		});
	});

	describe("Row iteration", () => {
		test("should iterate all rows", async () => {
			const csv = "name,age\nAlice,30\nBob,25\nCharlie,35";

			await using store = await createCsvStore({
				source: createStringByteSource(csv),
				backend: createJavaScriptIndexBackend(),
				indexStore: createMemoryIndexStore(),
				limits: testLimits,
			});

			await store.buildIndex();

			const rows: Array<{ name: string; age: string }> = [];

			for await (const row of store.rows()) {
				const name = await row.get(0);
				const age = await row.get(1);
				rows.push({ name, age });
			}

			expect(rows).toHaveLength(4); // including header
			expect(rows[0]).toEqual({ name: "name", age: "age" });
			expect(rows[1]).toEqual({ name: "Alice", age: "30" });
			expect(rows[2]).toEqual({ name: "Bob", age: "25" });
			expect(rows[3]).toEqual({ name: "Charlie", age: "35" });
		});

		test("should iterate with range", async () => {
			const csv = "name,age\nAlice,30\nBob,25\nCharlie,35\nDavid,40";

			await using store = await createCsvStore({
				source: createStringByteSource(csv),
				backend: createJavaScriptIndexBackend(),
				indexStore: createMemoryIndexStore(),
				limits: testLimits,
			});

			await store.buildIndex();

			const rows: string[] = [];

			// Get rows 1-2 (skip header at 0, skip David at 3)
			for await (const row of store.rows({ from: 1, to: 3 })) {
				const name = await row.get(0);
				rows.push(name);
			}

			expect(rows).toEqual(["Alice", "Bob"]);
		});
	});

	describe("Error handling", () => {
		test("should throw error when accessing before buildIndex", async () => {
			const csv = "name,age\nAlice,30";

			await using store = await createCsvStore({
				source: createStringByteSource(csv),
				backend: createJavaScriptIndexBackend(),
				indexStore: createMemoryIndexStore(),
				limits: testLimits,
			});

			// Should throw because index is not built
			await expect(store.getCell(0, 0)).rejects.toThrow(
				"Index not built. Call buildIndex() first.",
			);
		});

		test("should throw error when accessing out of bounds row", async () => {
			const csv = "name,age\nAlice,30";

			await using store = await createCsvStore({
				source: createStringByteSource(csv),
				backend: createJavaScriptIndexBackend(),
				indexStore: createMemoryIndexStore(),
				limits: testLimits,
			});

			await store.buildIndex();

			// Should throw because row 100 doesn't exist
			await expect(store.getCell(100, 0)).rejects.toThrow("out of bounds");
		});

		test("should throw error when accessing out of bounds column", async () => {
			const csv = "name,age\nAlice,30";

			await using store = await createCsvStore({
				source: createStringByteSource(csv),
				backend: createJavaScriptIndexBackend(),
				indexStore: createMemoryIndexStore(),
				limits: testLimits,
			});

			await store.buildIndex();

			// Should throw because column 10 doesn't exist
			await expect(store.getCell(0, 10)).rejects.toThrow("out of bounds");
		});
	});

	describe("Disposable", () => {
		test("should dispose resources with await using", async () => {
			const csv = "name,age\nAlice,30";

			{
				await using store = await createCsvStore({
					source: createStringByteSource(csv),
					backend: createJavaScriptIndexBackend(),
					indexStore: createMemoryIndexStore(),
					limits: testLimits,
				});

				await store.buildIndex();
				await store.getCell(0, 0);

				// Store is active here
			}

			// Store should be disposed here
			// (実際には破棄されているかを確認する方法がないが、エラーが出ないことを確認)
		});

		test("should dispose manually", async () => {
			const csv = "name,age\nAlice,30";

			const store = await createCsvStore({
				source: createStringByteSource(csv),
				backend: createJavaScriptIndexBackend(),
				indexStore: createMemoryIndexStore(),
				limits: testLimits,
			});

			await store.buildIndex();
			await store.getCell(0, 0);

			// Manual dispose
			await store[Symbol.asyncDispose]();

			// Should throw because store is disposed
			await expect(store.getCell(0, 0)).rejects.toThrow("disposed");
		});
	});
});
