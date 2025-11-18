import { parseString, ReusableWorkerPool } from "web-csv-toolbox";
// Import lite worker bundle URL from package exports
// Webpack's asset/resource type returns the URL for the module
import workerUrl from "web-csv-toolbox/worker/lite";

const csv = `name,age
Alice,30
Bob,25
Charlie,35`;

// Helper to display results
function displayResult(elementId: string, content: string, status: "info" | "success" | "error" = "success") {
  const element = document.getElementById(elementId);
  if (element) {
    element.innerHTML = `<div class="status ${status}">${content}</div>`;
  }
}

// Test 0: Basic Parsing (No Worker) - to verify library works
document.getElementById("test0")?.addEventListener("click", async () => {
  const button = document.getElementById("test0") as HTMLButtonElement;
  button.disabled = true;

  try {
    displayResult("result0", "⏳ Parsing without Worker...", "info");

    const records = [];
    for await (const record of parseString(csv)) {
      records.push(record);
    }

    displayResult(
      "result0",
      `✅ Basic parsing works:\n<pre>${JSON.stringify(records, null, 2)}</pre>`,
      "success"
    );
  } catch (error) {
    displayResult("result0", `❌ Error: ${error}<br><pre>${error instanceof Error ? error.stack : ''}</pre>`, "error");
    console.error("Test 0 error:", error);
  } finally {
    button.disabled = false;
  }
});

// Test 1: Worker (JavaScript Engine)
document.getElementById("test1")?.addEventListener("click", async () => {
  const button = document.getElementById("test1") as HTMLButtonElement;
  button.disabled = true;

  try {
    displayResult("result1", "⏳ Parsing with Worker (JavaScript engine, non-blocking)...", "info");

    const pool = new ReusableWorkerPool({
      maxWorkers: 2,
      workerURL: workerUrl,  // Imported from web-csv-toolbox/worker/lite
    });

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

      displayResult(
        "result1",
        `✅ Parsed Result (JavaScript):\n<pre>${JSON.stringify(records, null, 2)}</pre>`,
        "success"
      );
    } finally {
      pool[Symbol.dispose]();
    }
  } catch (error) {
    displayResult("result1", `❌ Error: ${error}<br><pre>${error instanceof Error ? error.stack : ''}</pre>`, "error");
    console.error("Test 1 error:", error);
  } finally {
    button.disabled = false;
  }
});

// Test 2: Worker + WASM
document.getElementById("test2")?.addEventListener("click", async () => {
  const button = document.getElementById("test2") as HTMLButtonElement;
  button.disabled = true;

  try {
    displayResult("result2", "⏳ Parsing with Worker + WASM (non-blocking)...", "info");

    const pool = new ReusableWorkerPool({
      maxWorkers: 2,
      workerURL: workerUrl,  // Imported from web-csv-toolbox/worker/lite
    });

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

      displayResult(
        "result2",
        `✅ Parsed Result (WASM in Worker):\n<pre>${JSON.stringify(records, null, 2)}</pre>`,
        "success"
      );
    } finally {
      pool[Symbol.dispose]();
    }
  } catch (error) {
    displayResult("result2", `❌ Error: ${error}<br><pre>${error instanceof Error ? error.stack : ''}</pre>`, "error");
    console.error("Test 2 error:", error);
  } finally {
    button.disabled = false;
  }
});

// Test 3: Parallel Processing
document.getElementById("test3")?.addEventListener("click", async () => {
  const button = document.getElementById("test3") as HTMLButtonElement;
  button.disabled = true;

  try {
    displayResult("result3", "⏳ Parallel processing: multiple CSV files with multiple Workers...", "info");

    const pool = new ReusableWorkerPool({
      maxWorkers: 3,
      workerURL: workerUrl,  // Imported from web-csv-toolbox/worker/lite
    });

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

      const resultText = results
        .map(({ index, records }) => `CSV ${index + 1}: ${JSON.stringify(records)}`)
        .join("\n");

      displayResult(
        "result3",
        `✅ Parallel parsing results:\n<pre>${resultText}</pre>`,
        "success"
      );
    } finally {
      pool[Symbol.dispose]();
    }
  } catch (error) {
    displayResult("result3", `❌ Error: ${error}<br><pre>${error instanceof Error ? error.stack : ''}</pre>`, "error");
    console.error("Test 3 error:", error);
  } finally {
    button.disabled = false;
  }
});
