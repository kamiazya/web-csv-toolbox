import { parseString, ReusableWorkerPool } from "web-csv-toolbox";
// Import slim worker bundle URL from package exports
// Webpack's asset/resource type returns the URL for the module
import workerUrl from "web-csv-toolbox/worker/slim";

const csv = `name,age
Alice,30
Bob,25
Charlie,35`;

// Helper to display results
function displayResult(
  elementId: string,
  message: string,
  status: "info" | "success" | "error" = "success",
  details?: string
) {
  const element = document.getElementById(elementId);
  if (!element) return;

  // Clear existing content
  element.innerHTML = "";

  // Create container with status class
  const container = document.createElement("div");
  container.className = `status ${status}`;

  // Create header for the main message
  const header = document.createElement("div");
  header.textContent = message;
  container.appendChild(header);

  // Add details in a <pre> element if provided
  if (details) {
    const pre = document.createElement("pre");
    pre.textContent = details;
    container.appendChild(pre);
  }

  element.appendChild(container);
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
      "✅ Basic parsing works:",
      "success",
      JSON.stringify(records, null, 2)
    );
  } catch (error) {
    displayResult("result0", `❌ Error: ${error}`, "error", error instanceof Error ? error.stack : undefined);
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

    using pool = new ReusableWorkerPool({
      maxWorkers: 2,
      workerURL: workerUrl,  // Imported from web-csv-toolbox/worker/slim
    });
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
        "✅ Parsed Result (JavaScript):",
        "success",
        JSON.stringify(records, null, 2)
      );
  } catch (error) {
    displayResult("result1", `❌ Error: ${error}`, "error", error instanceof Error ? error.stack : undefined);
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

    using pool = new ReusableWorkerPool({
      maxWorkers: 2,
      workerURL: workerUrl,  // Imported from web-csv-toolbox/worker/slim
    });
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
        "✅ Parsed Result (WASM in Worker):",
        "success",
        JSON.stringify(records, null, 2)
      );
  } catch (error) {
    displayResult("result2", `❌ Error: ${error}`, "error", error instanceof Error ? error.stack : undefined);
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

    using pool = new ReusableWorkerPool({
      maxWorkers: 3,
      workerURL: workerUrl,  // Imported from web-csv-toolbox/worker/slim
    });
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
        "✅ Parallel parsing results:",
        "success",
        resultText
      );
  } catch (error) {
    displayResult("result3", `❌ Error: ${error}`, "error", error instanceof Error ? error.stack : undefined);
    console.error("Test 3 error:", error);
  } finally {
    button.disabled = false;
  }
});
