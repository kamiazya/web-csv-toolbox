import { parseString, ReusableWorkerPool } from "web-csv-toolbox";

console.log("🚀 Node.js Worker (Main Version) Test");
console.log("Features: Worker-based parsing with auto WASM initialization\n");

const csv = `name,age
Alice,30
Bob,25
Charlie,35`;

console.log("CSV Input:");
console.log(csv);
console.log();

async function testWorkerParsing() {
  console.log("⏳ Parsing with Worker (JavaScript engine, non-blocking)...");

  // Create a worker pool (single task, not parallel processing)
  const pool = new ReusableWorkerPool({ maxWorkers: 2 });

  try {
    const records = [];
    for await (const record of parseString(csv, {
      engine: {
        worker: true,
        workerPool: pool,
      }
    })) {
      records.push(record);
    }

    console.log("✅ Parsed Result (JavaScript):");
    console.log(JSON.stringify(records, null, 2));
    console.log();
  } finally {
    // Explicitly terminate workers
    pool.terminate();
  }
}

async function testWorkerWASMParsing() {
  console.log("⏳ Parsing with Worker + WASM (non-blocking)...");

  // Create a worker pool (single task, not parallel processing)
  const pool = new ReusableWorkerPool({ maxWorkers: 2 });

  try {
    const records = [];
    for await (const record of parseString(csv, {
      engine: {
        worker: true,
        wasm: true,
        workerPool: pool,
      }
    })) {
      records.push(record);
    }

    console.log("✅ Parsed Result (WASM in Worker):");
    console.log(JSON.stringify(records, null, 2));
    console.log();
  } finally {
    pool.terminate();
  }
}

async function testParallelParsing() {
  console.log("⏳ Parallel processing: multiple CSV files with multiple Workers...");

  // Create a worker pool for parallel processing (3 concurrent tasks)
  const pool = new ReusableWorkerPool({ maxWorkers: 3 });

  try {
    const csvFiles = [
      "a,b\n1,2\n3,4",
      "x,y\n10,20\n30,40",
      "foo,bar\n100,200\n300,400"
    ];

    const results = await Promise.all(
      csvFiles.map(async (csv, index) => {
        const records = [];
        for await (const record of parseString(csv, {
          engine: {
            worker: true,
            wasm: true,
            workerPool: pool,
          }
        })) {
          records.push(record);
        }
        return { index, records };
      })
    );

    console.log("✅ Parallel parsing results:");
    results.forEach(({ index, records }) => {
      console.log(`  CSV ${index + 1}:`, JSON.stringify(records));
    });
    console.log();
  } finally {
    pool.terminate();
  }
}

try {
  await testWorkerParsing();
  await testWorkerWASMParsing();
  await testParallelParsing();

  console.log("✨ Success! Worker-based parsing works in Node.js");
} catch (error) {
  console.error("❌ Error:", error);
  process.exit(1);
}
