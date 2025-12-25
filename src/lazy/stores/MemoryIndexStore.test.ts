import { describe, expect, test } from "vitest";
import {
	MemoryIndexStore,
	createMemoryIndexStore,
} from "./MemoryIndexStore.js";
import type { IndexArtifact } from "../types.js";

describe("MemoryIndexStore", () => {
	const createTestArtifact = (): IndexArtifact => ({
		formatVersion: 1,
		createdAtMs: Date.now(),
		sourceIdentity: {
			id: "test-source",
			size: 1000n,
		},
		limits: {
			maxFieldBytes: 1024,
			maxRecordBytes: 10240,
			maxFieldsPerRecord: 100,
		},
		core: {
			recordStart64: new BigUint64Array([0n, 10n, 20n]),
			rowMeta: new Uint32Array([0, 2, 2, 2, 4, 2]),
			fieldBlob: new Uint8Array([1, 2, 3, 4, 5, 6]),
		},
	});

	test("should create store", async () => {
		await using store = createMemoryIndexStore();

		expect(store).toBeInstanceOf(MemoryIndexStore);
	});

	test("should save and load artifact", async () => {
		await using store = createMemoryIndexStore();

		const artifact = createTestArtifact();

		await store.save("key1", artifact);
		const loaded = await store.load("key1");

		expect(loaded).not.toBeNull();
		expect(loaded?.formatVersion).toBe(1);
		expect(loaded?.sourceIdentity.id).toBe("test-source");
	});

	test("should return null for non-existent key", async () => {
		await using store = createMemoryIndexStore();

		const loaded = await store.load("non-existent");

		expect(loaded).toBeNull();
	});

	test("should delete artifact", async () => {
		await using store = createMemoryIndexStore();

		const artifact = createTestArtifact();

		await store.save("key1", artifact);
		await store.delete("key1");
		const loaded = await store.load("key1");

		expect(loaded).toBeNull();
	});

	test("should clear all artifacts", async () => {
		await using store = createMemoryIndexStore();

		await store.save("key1", createTestArtifact());
		await store.save("key2", createTestArtifact());

		expect(store.size).toBe(2);

		await store.clear();

		expect(store.size).toBe(0);
	});

	test("should get all keys", async () => {
		await using store = createMemoryIndexStore();

		await store.save("key1", createTestArtifact());
		await store.save("key2", createTestArtifact());

		const keys = store.keys();

		expect(keys).toContain("key1");
		expect(keys).toContain("key2");
		expect(keys).toHaveLength(2);
	});

	test("should dispose", async () => {
		const store = createMemoryIndexStore();

		await store.save("key1", createTestArtifact());
		expect(store.size).toBe(1);

		await store[Symbol.asyncDispose]();

		// Should throw because store is disposed
		await expect(store.load("key1")).rejects.toThrow("disposed");
	});

	test("should deep copy artifact on save", async () => {
		await using store = createMemoryIndexStore();

		const artifact = createTestArtifact();
		const originalRecordStart = artifact.core.recordStart64[0];

		await store.save("key1", artifact);

		// Modify original
		artifact.core.recordStart64[0] = 999n;

		// Loaded should not be affected
		const loaded = await store.load("key1");
		expect(loaded?.core.recordStart64[0]).toBe(originalRecordStart);
		expect(loaded?.core.recordStart64[0]).not.toBe(999n);
	});
});
