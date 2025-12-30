import { describe, expect, it, vi } from "vitest";
import { createStringExecutionSelector } from "./ExecutionStrategySelector.ts";
import type { InternalEngineConfig } from "@/engine/config/InternalEngineConfig.ts";

describe("ExecutionStrategySelector", () => {
  it("should execute GPU path when GPU is enabled and available", async () => {
    const gpuExecutor = vi.fn(async function* () {
      yield { name: "Alice", age: "42" };
    });
    const jsExecutor = vi.fn(function* () {
      yield { name: "Bob", age: "69" };
    });

    const selector = createStringExecutionSelector(gpuExecutor as any, jsExecutor as any);

    // Override the GPU strategy's isAvailable to return true
    selector["strategies"][0].isAvailable = async () => true;

    const mockEngineConfig = {
      hasGPU: () => true,
      hasWasm: () => false,
      onFallback: vi.fn(),
      toConfig: () => ({ gpu: true, wasm: false }),
      createGPUFallbackConfig: () => ({
        toConfig: () => ({ gpu: false, wasm: false }),
      }),
      createWasmFallbackConfig: () => ({
        toConfig: () => ({ gpu: false, wasm: false }),
      }),
    } as unknown as InternalEngineConfig;

    const results: any[] = [];
    for await (const record of selector.execute("csv", undefined, mockEngineConfig)) {
      results.push(record);
    }

    expect(gpuExecutor).toHaveBeenCalled();
    expect(jsExecutor).not.toHaveBeenCalled();
    expect(results).toEqual([{ name: "Alice", age: "42" }]);
  });

  it("should fallback to WASM when GPU fails", async () => {
    const gpuExecutor = vi.fn(async function* (): any {
      throw new Error("GPU not available");
    });
    const jsExecutor = vi.fn(function* () {
      yield { name: "Bob", age: "69" };
    });

    const selector = createStringExecutionSelector(gpuExecutor as any, jsExecutor as any);

    // Override availability checks
    selector["strategies"][0].isAvailable = async () => true; // GPU available but will fail
    selector["strategies"][1].isAvailable = async () => true; // WASM available

    const onFallback = vi.fn();
    const mockEngineConfig = {
      hasGPU: () => true,
      hasWasm: () => true,
      onFallback,
      toConfig: () => ({ gpu: true, wasm: true }),
      createGPUFallbackConfig: () => ({
        toConfig: () => ({ gpu: false, wasm: true }),
      }),
      createWasmFallbackConfig: () => ({
        toConfig: () => ({ gpu: false, wasm: false }),
      }),
    } as unknown as InternalEngineConfig;

    const results: any[] = [];
    for await (const record of selector.execute("csv", undefined, mockEngineConfig)) {
      results.push(record);
    }

    expect(gpuExecutor).toHaveBeenCalled();
    expect(onFallback).toHaveBeenCalled();
    // WASM executor is called internally by the selector
    expect(results.length).toBeGreaterThan(0);
  });

  it("should execute JavaScript path when neither GPU nor WASM is enabled", async () => {
    const gpuExecutor = vi.fn(async function* () {
      yield { name: "Alice", age: "42" };
    });
    const jsExecutor = vi.fn(function* () {
      yield { name: "Bob", age: "69" };
    });

    const selector = createStringExecutionSelector(gpuExecutor as any, jsExecutor as any);

    const mockEngineConfig = {
      hasGPU: () => false,
      hasWasm: () => false,
      onFallback: vi.fn(),
      toConfig: () => ({ gpu: false, wasm: false }),
      createGPUFallbackConfig: () => ({
        toConfig: () => ({ gpu: false, wasm: false }),
      }),
      createWasmFallbackConfig: () => ({
        toConfig: () => ({ gpu: false, wasm: false }),
      }),
    } as unknown as InternalEngineConfig;

    const results: any[] = [];
    for await (const record of selector.execute("csv", undefined, mockEngineConfig)) {
      results.push(record);
    }

    expect(gpuExecutor).not.toHaveBeenCalled();
    expect(jsExecutor).toHaveBeenCalled();
    expect(results).toEqual([{ name: "Bob", age: "69" }]);
  });
});
