import {
  parseString,
  parseBinaryStream,
  ReusableWorkerPool,
  EnginePresets,
} from "web-csv-toolbox";
import workerUrl from "web-csv-toolbox/worker?url";

// Test CSV data
const testCSV = `name,age,city
Alice,30,Tokyo
Bob,25,Osaka
Charlie,35,Kyoto`;

// Large CSV for performance testing
function generateLargeCSV(rows: number): string {
  const lines = ["id,name,value,timestamp"];
  for (let i = 0; i < rows; i++) {
    lines.push(`${i},item${i},${Math.random() * 1000},${Date.now()}`);
  }
  return lines.join("\n");
}

// Result display helper
function displayResult(
  elementId: string,
  message: string,
  status: "loading" | "success" | "error" | "warning" | "info",
  details?: string
) {
  const element = document.getElementById(elementId);
  if (!element) return;

  element.innerHTML = "";
  const container = document.createElement("div");
  container.className = `result-box ${status}`;

  const header = document.createElement("div");
  header.className = "result-header";
  header.textContent = message;
  container.appendChild(header);

  if (details) {
    const pre = document.createElement("pre");
    pre.textContent = details;
    container.appendChild(pre);
  }

  element.appendChild(container);
}

// Check WebGPU availability
async function checkGPUAvailability(): Promise<{
  available: boolean;
  adapter: GPUAdapter | null;
  info: string;
}> {
  if (!navigator.gpu) {
    return { available: false, adapter: null, info: "WebGPU not supported in this browser" };
  }

  try {
    const adapter = await navigator.gpu.requestAdapter();
    if (!adapter) {
      return { available: false, adapter: null, info: "No GPU adapter available" };
    }

    // GPUAdapterInfo is available directly on the adapter
    const info = adapter.info;
    return {
      available: true,
      adapter,
      info: `Vendor: ${info.vendor}, Architecture: ${info.architecture}, Device: ${info.device}`,
    };
  } catch (error) {
    return {
      available: false,
      adapter: null,
      info: `GPU error: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

// Initialize page
async function init() {
  // Check GPU availability
  const gpuStatus = await checkGPUAvailability();
  const gpuStatusEl = document.getElementById("gpu-status");
  if (gpuStatusEl) {
    gpuStatusEl.innerHTML = gpuStatus.available
      ? `<span class="badge success">Available</span> ${gpuStatus.info}`
      : `<span class="badge warning">Not Available</span> ${gpuStatus.info}`;
  }

  // Expose test results to window for Playwright
  (window as any).testResults = {};
}

// ===== Test: JavaScript Engine (stable preset) =====
document.getElementById("btn-test-js")?.addEventListener("click", async () => {
  const btn = document.getElementById("btn-test-js") as HTMLButtonElement;
  btn.disabled = true;

  try {
    displayResult("result-js", "Running JavaScript engine test...", "loading");
    const startTime = performance.now();

    const records = [];
    for await (const record of parseString(testCSV, {
      engine: EnginePresets.stable(),
    })) {
      records.push(record);
    }

    const elapsed = performance.now() - startTime;
    (window as any).testResults.js = { success: true, records, elapsed };

    displayResult(
      "result-js",
      `JavaScript Engine: ${records.length} records in ${elapsed.toFixed(2)}ms`,
      "success",
      JSON.stringify(records, null, 2)
    );
  } catch (error) {
    (window as any).testResults.js = { success: false, error: String(error) };
    displayResult(
      "result-js",
      `JavaScript Engine Error: ${error}`,
      "error",
      error instanceof Error ? error.stack : undefined
    );
  } finally {
    btn.disabled = false;
  }
});

// ===== Test: WASM Engine =====
document.getElementById("btn-test-wasm")?.addEventListener("click", async () => {
  const btn = document.getElementById("btn-test-wasm") as HTMLButtonElement;
  btn.disabled = true;

  try {
    displayResult("result-wasm", "Running WASM engine test...", "loading");
    const startTime = performance.now();

    const records = [];
    for await (const record of parseString(testCSV, {
      engine: { wasm: true, worker: false, gpu: false },
    })) {
      records.push(record);
    }

    const elapsed = performance.now() - startTime;
    (window as any).testResults.wasm = { success: true, records, elapsed };

    displayResult(
      "result-wasm",
      `WASM Engine: ${records.length} records in ${elapsed.toFixed(2)}ms`,
      "success",
      JSON.stringify(records, null, 2)
    );
  } catch (error) {
    (window as any).testResults.wasm = { success: false, error: String(error) };
    displayResult(
      "result-wasm",
      `WASM Engine Error: ${error}`,
      "error",
      error instanceof Error ? error.stack : undefined
    );
  } finally {
    btn.disabled = false;
  }
});

// ===== Test: Worker Engine =====
document.getElementById("btn-test-worker")?.addEventListener("click", async () => {
  const btn = document.getElementById("btn-test-worker") as HTMLButtonElement;
  btn.disabled = true;

  try {
    displayResult("result-worker", "Running Worker engine test...", "loading");
    const startTime = performance.now();

    // TODO: When Node.js 24 becomes the minimum supported version, use:
    // using pool = new ReusableWorkerPool({ maxWorkers: 2, workerURL: workerUrl });
    const pool = new ReusableWorkerPool({
      maxWorkers: 2,
      workerURL: workerUrl,
    });

    try {
      const records = [];
      for await (const record of parseString(testCSV, {
        engine: EnginePresets.recommended({ workerPool: pool }),
      })) {
        records.push(record);
      }

      const elapsed = performance.now() - startTime;
      (window as any).testResults.worker = { success: true, records, elapsed };

      displayResult(
        "result-worker",
        `Worker Engine (WASM in Worker): ${records.length} records in ${elapsed.toFixed(2)}ms`,
        "success",
        JSON.stringify(records, null, 2)
      );
    } finally {
      pool.terminate();
    }
  } catch (error) {
    (window as any).testResults.worker = { success: false, error: String(error) };
    displayResult(
      "result-worker",
      `Worker Engine Error: ${error}`,
      "error",
      error instanceof Error ? error.stack : undefined
    );
  } finally {
    btn.disabled = false;
  }
});

// ===== Test: GPU Engine =====
document.getElementById("btn-test-gpu")?.addEventListener("click", async () => {
  const btn = document.getElementById("btn-test-gpu") as HTMLButtonElement;
  btn.disabled = true;

  try {
    displayResult("result-gpu", "Running GPU engine test...", "loading");

    // Check GPU availability first
    const gpuStatus = await checkGPUAvailability();
    if (!gpuStatus.available) {
      (window as any).testResults.gpu = { success: false, error: gpuStatus.info, skipped: true };
      displayResult(
        "result-gpu",
        `GPU not available: ${gpuStatus.info}`,
        "warning"
      );
      return;
    }

    const startTime = performance.now();

    // Use binary stream for GPU parsing (GPU works with binary data)
    const encoder = new TextEncoder();
    const binaryData = encoder.encode(testCSV);
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(binaryData);
        controller.close();
      },
    });

    const records = [];
    for await (const record of parseBinaryStream(stream, {
      engine: EnginePresets.turbo(),
    })) {
      records.push(record);
    }

    const elapsed = performance.now() - startTime;
    (window as any).testResults.gpu = { success: true, records, elapsed };

    displayResult(
      "result-gpu",
      `GPU Engine: ${records.length} records in ${elapsed.toFixed(2)}ms`,
      "success",
      JSON.stringify(records, null, 2)
    );
  } catch (error) {
    (window as any).testResults.gpu = { success: false, error: String(error) };
    displayResult(
      "result-gpu",
      `GPU Engine Error: ${error}`,
      "error",
      error instanceof Error ? error.stack : undefined
    );
  } finally {
    btn.disabled = false;
  }
});

// ===== Test: Performance Comparison =====
document.getElementById("btn-test-perf")?.addEventListener("click", async () => {
  const btn = document.getElementById("btn-test-perf") as HTMLButtonElement;
  btn.disabled = true;

  const largeCSV = generateLargeCSV(10000);
  const results: { engine: string; elapsed: number; records: number }[] = [];

  try {
    displayResult("result-perf", "Running performance comparison...", "loading");

    // JavaScript
    {
      const start = performance.now();
      let count = 0;
      for await (const _ of parseString(largeCSV, {
        engine: EnginePresets.stable(),
      })) {
        count++;
      }
      results.push({ engine: "JavaScript", elapsed: performance.now() - start, records: count });
    }

    // WASM
    {
      const start = performance.now();
      let count = 0;
      for await (const _ of parseString(largeCSV, {
        engine: { wasm: true, worker: false, gpu: false },
      })) {
        count++;
      }
      results.push({ engine: "WASM", elapsed: performance.now() - start, records: count });
    }

    // Worker + WASM
    {
      // TODO: When Node.js 24 becomes the minimum supported version, use:
      // using pool = new ReusableWorkerPool({ maxWorkers: 2, workerURL: workerUrl });
      const pool = new ReusableWorkerPool({ maxWorkers: 2, workerURL: workerUrl });
      try {
        const start = performance.now();
        let count = 0;
        for await (const _ of parseString(largeCSV, {
          engine: EnginePresets.recommended({ workerPool: pool }),
        })) {
          count++;
        }
        results.push({ engine: "Worker+WASM", elapsed: performance.now() - start, records: count });
      } finally {
        pool.terminate();
      }
    }

    // GPU (if available)
    const gpuStatus = await checkGPUAvailability();
    if (gpuStatus.available) {
      const encoder = new TextEncoder();
      const stream = new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(encoder.encode(largeCSV));
          controller.close();
        },
      });

      const start = performance.now();
      let count = 0;
      for await (const _ of parseBinaryStream(stream, {
        engine: EnginePresets.turbo(),
      })) {
        count++;
      }
      results.push({ engine: "GPU", elapsed: performance.now() - start, records: count });
    }

    (window as any).testResults.perf = { success: true, results };

    const resultText = results
      .sort((a, b) => a.elapsed - b.elapsed)
      .map((r, i) => `${i + 1}. ${r.engine}: ${r.elapsed.toFixed(2)}ms (${r.records} records)`)
      .join("\n");

    displayResult(
      "result-perf",
      `Performance (10,000 rows):`,
      "success",
      resultText
    );
  } catch (error) {
    (window as any).testResults.perf = { success: false, error: String(error) };
    displayResult(
      "result-perf",
      `Performance Test Error: ${error}`,
      "error",
      error instanceof Error ? error.stack : undefined
    );
  } finally {
    btn.disabled = false;
  }
});

// Run all tests (for automated testing)
document.getElementById("btn-run-all")?.addEventListener("click", async () => {
  const buttons = [
    "btn-test-js",
    "btn-test-wasm",
    "btn-test-worker",
    "btn-test-gpu",
  ];

  for (const id of buttons) {
    const btn = document.getElementById(id);
    if (btn) {
      btn.click();
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }
});

// Initialize
init();
