/**
 * Create a Worker instance for browser/Deno environment.
 *
 * @internal
 * @param workerURL Custom worker URL or undefined to use bundled worker
 * @returns Worker instance
 */
export async function createWorker(workerURL?: string | URL): Promise<Worker> {
  // Use @vite-ignore to prevent Vite from inlining the worker as a data URL
  // In production, import.meta.url points to dist/worker/helpers/createWorker.web.js
  // so "../../worker.web.js" correctly resolves to dist/worker.web.js
  const url =
    workerURL ||
    new URL(/* @vite-ignore */ "../../worker.web.js", import.meta.url);

  try {
    return new Worker(url, { type: "module" });
  } catch (error) {
    const message = [
      "Failed to create Worker.",
      "",
      "In bundled environments (Vite, webpack, etc.), you must explicitly provide workerURL:",
      "",
      "Option 1: Create a worker entry file (recommended)",
      "  // csv-worker.ts",
      '  export * from "web-csv-toolbox/worker";',
      "",
      "  // vite.config.ts",
      "  build: {",
      "    rollupOptions: {",
      "      input: {",
      '        main: "index.html",',
      '        worker: "csv-worker.ts"',
      "      }",
      "    }",
      "  }",
      "",
      "  // Usage",
      '  new ReusableWorkerPool({ workerURL: "./worker.js" })',
      "",
      "Option 2: Copy worker files and dependencies to dist/",
      "  See: https://github.com/kamiazya/web-csv-toolbox/tree/main/examples/vite-bundle-worker-main",
      "",
      `Original error: ${error}`,
    ].join("\n");

    throw new Error(message);
  }
}
