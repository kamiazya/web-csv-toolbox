import { codecovVitePlugin } from "@codecov/vite-plugin";
import dts from "vite-plugin-dts";
import { defineConfig } from "vitest/config";
import wasmPack from "./config/vite-plugin-wasm-pack.ts";

export default defineConfig(env => ({
  resolve: {
    alias: {
      "#execution/worker/createWorker.js": "/src/execution/worker/createWorker.ts",
    },
  },
  build: {
    target: "esnext",
    lib: {
      entry: [
        "src/web-csv-toolbox.ts",
        "src/loadWASM.web.ts",
        "src/execution/worker/worker.ts",
        "src/execution/worker/createWorker.web.ts",
      ],
      name: "CSV",
      formats: ["es"],
      fileName: (format, entryName) => {
        return `${entryName}.js`;
      },
    },
    minify: "terser",
    sourcemap: true,
    rollupOptions: {
      external: [
        "node:worker_threads",
        "node:url",
        "node:path",
      ],
      output: {
        inlineDynamicImports: false,
        preserveModules: true,
        preserveModulesRoot: "src",
        exports: "named",
      },
    },
  },
  esbuild: {
    minifyIdentifiers: false,
    keepNames: true,
    minifySyntax: true,
  },
  plugins: [
    wasmPack({
      crates: ["./web-csv-toolbox-wasm"],
    }),
    dts({
      insertTypesEntry: true,
      outDir: "dist",
      exclude: ["**/*.spec.ts", "**/__tests__/**/*"],
      copyDtsFiles: true,
    }),
    codecovVitePlugin({
      enableBundleAnalysis: process.env.CODECOV_TOKEN !== undefined,
      bundleName: "web-csv-toolbox",
      uploadToken: process.env.CODECOV_TOKEN,
    }),
  ],
  test: {
    setupFiles: ["config/vitest.setup.ts"],
    browser: {
      name: "chrome",
    },
    coverage: {
      provider: "istanbul", // use istanbul for browser coverage
      include: ["src/**/*.ts"],
    },
  },
}));
