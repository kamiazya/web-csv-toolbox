/**
 * Basic usage examples for WebGPU CSV Parser
 *
 * These examples demonstrate common use cases and patterns.
 */

import {
	StreamParser,
	parseCSVStream,
	isWebGPUAvailable,
	type CSVRecord,
} from "../index.ts";

/**
 * Example 1: Simple streaming parse
 *
 * Parse a CSV file from a URL and collect all records.
 */
export async function example1_basicParsing() {
	console.log("=== Example 1: Basic Parsing ===");

	// Check WebGPU availability
	if (!isWebGPUAvailable()) {
		console.error("WebGPU is not available in this browser");
		return;
	}

	// Fetch CSV data
	const response = await fetch("https://example.com/data.csv");
	if (!response.body) {
		throw new Error("Response body is null");
	}

	// Parse all records
	const records = await parseCSVStream(response.body);

	console.log(`Parsed ${records.length} records`);
	console.log("First record:", records[0]);
}

/**
 * Example 2: Streaming with callbacks
 *
 * Process records as they're parsed to minimize memory usage.
 */
export async function example2_streamingCallbacks(
	stream: ReadableStream<Uint8Array>,
) {
	console.log("=== Example 2: Streaming Callbacks ===");

	let recordCount = 0;

	const parser = new StreamParser({
		onRecord: async (record: CSVRecord) => {
			recordCount++;

			// Process record (e.g., insert into database)
			console.log(`Record ${recordCount}:`, record.fields.map((f) => f.value));

			// Simulate async processing
			await new Promise((resolve) => setTimeout(resolve, 10));
		},
		onError: (error: Error) => {
			console.error("Parse error:", error);
		},
	});

	await parser.initialize();
	await parser.parseStream(stream);
	await parser.destroy();

	console.log(`Total records processed: ${recordCount}`);
}

/**
 * Example 3: Large file with custom chunk size
 *
 * Configure larger chunks for better throughput on large files.
 */
export async function example3_largeFiles(
	stream: ReadableStream<Uint8Array>,
) {
	console.log("=== Example 3: Large File Parsing ===");

	const records: CSVRecord[] = [];

	const parser = new StreamParser({
		config: {
			chunkSize: 4 * 1024 * 1024, // 4MB chunks for large files
			maxSeparators: 1000000, // Expect lots of fields
		},
		onRecord: (record) => {
			records.push(record);

			// Progress reporting every 10,000 records
			if (records.length % 10000 === 0) {
				console.log(`Processed ${records.length} records...`);
			}
		},
	});

	await parser.initialize();
	const startTime = performance.now();

	await parser.parseStream(stream);

	const endTime = performance.now();
	const duration = (endTime - startTime) / 1000;

	console.log(`Parsed ${records.length} records in ${duration.toFixed(2)}s`);
	console.log(`Throughput: ${(records.length / duration).toFixed(0)} records/sec`);

	await parser.destroy();
}

/**
 * Example 4: Reusing GPU device
 *
 * Share a single GPU device across multiple parsers for efficiency.
 */
export async function example4_deviceReuse() {
	console.log("=== Example 4: GPU Device Reuse ===");

	// Create shared GPU device
	const adapter = await navigator.gpu.requestAdapter();
	if (!adapter) {
		throw new Error("Failed to get GPU adapter");
	}
	const device = await adapter.requestDevice();

	// Create multiple parsers sharing the device
	const parser1 = new StreamParser({
		config: { device },
	});

	const parser2 = new StreamParser({
		config: { device },
	});

	// Use parsers...
	await parser1.initialize();
	await parser2.initialize();

	// (parse operations here)

	// Cleanup
	await parser1.destroy();
	await parser2.destroy();
	device.destroy();

	console.log("Successfully reused GPU device across parsers");
}

/**
 * Example 5: Error handling and validation
 *
 * Demonstrate robust error handling and record validation.
 */
export async function example5_errorHandling(
	stream: ReadableStream<Uint8Array>,
) {
	console.log("=== Example 5: Error Handling ===");

	const validRecords: CSVRecord[] = [];
	const errorRecords: { record: CSVRecord; error: string }[] = [];

	const parser = new StreamParser({
		onRecord: (record) => {
			try {
				// Custom validation
				if (record.fields.length !== 3) {
					throw new Error(
						`Expected 3 fields, got ${record.fields.length}`,
					);
				}

				// Validate field values
				const [id, name, value] = record.fields.map((f) => f.value);

				if (!id || Number.isNaN(Number.parseInt(id, 10))) {
					throw new Error("Invalid ID field");
				}

				if (!name) {
					throw new Error("Name field is empty");
				}

				validRecords.push(record);
			} catch (error) {
				errorRecords.push({
					record,
					error: error instanceof Error ? error.message : String(error),
				});
			}
		},
		onError: (error) => {
			console.error("Parser error:", error);
		},
	});

	await parser.initialize();
	await parser.parseStream(stream);
	await parser.destroy();

	console.log(`Valid records: ${validRecords.length}`);
	console.log(`Invalid records: ${errorRecords.length}`);

	if (errorRecords.length > 0) {
		console.log("First error:", errorRecords[0]);
	}
}

/**
 * Example 6: CSV with BOM and CRLF
 *
 * Handle files with UTF-8 BOM and Windows line endings.
 */
export async function example6_bomAndCRLF() {
	console.log("=== Example 6: BOM and CRLF Handling ===");

	// Simulate CSV with BOM and CRLF
	const csvData = new Uint8Array([
		0xef,
		0xbb,
		0xbf, // UTF-8 BOM
		...new TextEncoder().encode('name,value\r\n"Alice",100\r\n"Bob",200\r\n'),
	]);

	const stream = new ReadableStream({
		start(controller) {
			controller.enqueue(csvData);
			controller.close();
		},
	});

	const records = await parseCSVStream(stream, {
		skipBOM: false, // Explicitly handle BOM (default)
	});

	console.log("Parsed records:");
	for (const record of records) {
		console.log(record.fields.map((f) => f.value));
	}
}

/**
 * Example 7: Performance monitoring
 *
 * Track detailed performance metrics during parsing.
 */
export async function example7_performanceMonitoring(
	stream: ReadableStream<Uint8Array>,
) {
	console.log("=== Example 7: Performance Monitoring ===");

	const metrics = {
		startTime: 0,
		endTime: 0,
		recordCount: 0,
		byteCount: 0,
		chunkCount: 0,
	};

	const parser = new StreamParser({
		config: {
			chunkSize: 1 * 1024 * 1024, // 1MB chunks
		},
		onRecord: (record) => {
			metrics.recordCount++;
			// Estimate bytes (rough approximation)
			metrics.byteCount += record.fields.reduce(
				(sum, f) => sum + f.value.length,
				0,
			);
		},
	});

	await parser.initialize();

	metrics.startTime = performance.now();
	await parser.parseStream(stream);
	metrics.endTime = performance.now();

	await parser.destroy();

	const duration = (metrics.endTime - metrics.startTime) / 1000;
	const throughputMB = metrics.byteCount / duration / (1024 * 1024);

	console.log("Performance Metrics:");
	console.log(`  Duration: ${duration.toFixed(2)}s`);
	console.log(`  Records: ${metrics.recordCount.toLocaleString()}`);
	console.log(`  Bytes: ${metrics.byteCount.toLocaleString()}`);
	console.log(`  Throughput: ${throughputMB.toFixed(2)} MB/s`);
	console.log(`  Records/sec: ${(metrics.recordCount / duration).toFixed(0)}`);
}

// Export all examples
export const examples = {
	example1_basicParsing,
	example2_streamingCallbacks,
	example3_largeFiles,
	example4_deviceReuse,
	example5_errorHandling,
	example6_bomAndCRLF,
	example7_performanceMonitoring,
};
