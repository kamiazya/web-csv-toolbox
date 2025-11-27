import { test, expect } from "@playwright/test";

/**
 * Engine test suite for web-csv-toolbox.
 *
 * Tests JavaScript, WASM, Worker, and GPU parsing engines.
 */

test.describe("CSV Parsing Engines", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    // Wait for page to initialize
    await page.waitForSelector("#gpu-status");
  });

  test("JavaScript engine parses CSV correctly", async ({ page }) => {
    // Click JS test button
    await page.click("#btn-test-js");

    // Wait for result
    await page.waitForSelector("#result-js .result-box.success", {
      timeout: 10000,
    });

    // Verify result
    const result = await page.evaluate(() => (window as any).testResults.js);
    expect(result.success).toBe(true);
    expect(result.records).toHaveLength(3);
    expect(result.records[0]).toEqual({
      name: "Alice",
      age: "30",
      city: "Tokyo",
    });
  });

  test("WASM engine parses CSV correctly", async ({ page }) => {
    // Click WASM test button
    await page.click("#btn-test-wasm");

    // Wait for result
    await page.waitForSelector("#result-wasm .result-box.success", {
      timeout: 10000,
    });

    // Verify result
    const result = await page.evaluate(() => (window as any).testResults.wasm);
    expect(result.success).toBe(true);
    expect(result.records).toHaveLength(3);
    expect(result.records[0]).toEqual({
      name: "Alice",
      age: "30",
      city: "Tokyo",
    });
  });

  test("Worker engine parses CSV correctly", async ({ page }) => {
    // Click Worker test button
    await page.click("#btn-test-worker");

    // Wait for result (Worker may take longer)
    await page.waitForSelector("#result-worker .result-box.success", {
      timeout: 15000,
    });

    // Verify result
    const result = await page.evaluate(
      () => (window as any).testResults.worker
    );
    expect(result.success).toBe(true);
    expect(result.records).toHaveLength(3);
    expect(result.records[0]).toEqual({
      name: "Alice",
      age: "30",
      city: "Tokyo",
    });
  });
});

test.describe("GPU Parsing Engine", () => {
  // GPU tests only run in chromium-gpu project
  test.skip(
    ({ browserName }) => browserName !== "chromium",
    "GPU tests only run in Chromium"
  );

  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.waitForSelector("#gpu-status");
  });

  test("GPU engine parses CSV when WebGPU is available", async ({ page }) => {
    // Check if GPU is available
    const gpuAvailable = await page.evaluate(async () => {
      if (!navigator.gpu) return false;
      const adapter = await navigator.gpu.requestAdapter();
      return adapter !== null;
    });

    // Click GPU test button
    await page.click("#btn-test-gpu");

    // Wait for result
    await page.waitForSelector(
      "#result-gpu .result-box.success, #result-gpu .result-box.warning",
      { timeout: 15000 }
    );

    // Verify result
    const result = await page.evaluate(() => (window as any).testResults.gpu);

    if (gpuAvailable) {
      expect(result.success).toBe(true);
      expect(result.records).toHaveLength(3);
      expect(result.records[0]).toEqual({
        name: "Alice",
        age: "30",
        city: "Tokyo",
      });
    } else {
      // GPU not available - should show warning
      expect(result.skipped).toBe(true);
      console.log("GPU not available in this environment:", result.error);
    }
  });

  test("detects WebGPU availability", async ({ page }) => {
    const gpuStatus = await page.evaluate(async () => {
      if (!navigator.gpu) {
        return { available: false, reason: "navigator.gpu not supported" };
      }
      try {
        const adapter = await navigator.gpu.requestAdapter();
        if (!adapter) {
          return { available: false, reason: "No adapter available" };
        }
        const info = adapter.info;
        return {
          available: true,
          vendor: info.vendor,
          architecture: info.architecture,
          device: info.device,
        };
      } catch (e) {
        return {
          available: false,
          reason: e instanceof Error ? e.message : String(e),
        };
      }
    });

    console.log("WebGPU Status:", JSON.stringify(gpuStatus, null, 2));

    // This test is informational - just log the status
    expect(gpuStatus).toBeDefined();
  });
});

test.describe("Performance Comparison", () => {
  test("performance benchmark runs successfully", async ({ page }) => {
    test.slow(); // This test may take longer

    await page.goto("/");
    await page.waitForSelector("#gpu-status");

    // Click performance test button
    await page.click("#btn-test-perf");

    // Wait for result (benchmark takes longer)
    await page.waitForSelector("#result-perf .result-box.success", {
      timeout: 60000,
    });

    // Verify result
    const result = await page.evaluate(() => (window as any).testResults.perf);
    expect(result.success).toBe(true);
    expect(result.results.length).toBeGreaterThanOrEqual(3); // JS, WASM, Worker at minimum

    // Log performance results
    console.log("Performance Results:");
    for (const r of result.results) {
      console.log(`  ${r.engine}: ${r.elapsed.toFixed(2)}ms (${r.records} records)`);
    }
  });
});

test.describe("Cross-browser Compatibility", () => {
  test("basic parsing works in all browsers", async ({ page, browserName }) => {
    await page.goto("/");
    await page.waitForSelector("#gpu-status");

    // Run JS test (should work in all browsers)
    await page.click("#btn-test-js");
    await page.waitForSelector("#result-js .result-box.success", {
      timeout: 10000,
    });

    const result = await page.evaluate(() => (window as any).testResults.js);
    expect(result.success).toBe(true);
    console.log(`${browserName}: JavaScript engine works correctly`);
  });
});
