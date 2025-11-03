import { codecovVitePlugin } from "@codecov/vite-plugin";
import { webdriverio } from "@vitest/browser-webdriverio";
import dts from "vite-plugin-dts";
import { defineConfig } from "vitest/config";
import wasmPack from "./config/vite-plugin-wasm-pack.ts";

export default defineConfig(({ command }) => ({
  resolve: {
    alias: {
      // Aliases for testing only - production uses package.json "imports"
      "#execution/worker/createWorker.js": "/src/execution/worker/helpers/createWorker.web.ts",
      "#execution/worker/parseStringInWorker.js": "/src/execution/worker/parseStringInWorker.web.ts",
      "#execution/worker/parseStringInWorkerWASM.js": "/src/execution/worker/parseStringInWorkerWASM.web.ts",
      "#execution/worker/parseBinaryInWorker.js": "/src/execution/worker/parseBinaryInWorker.web.ts",
      "#execution/worker/parseBinaryInWorkerWASM.js": "/src/execution/worker/parseBinaryInWorkerWASM.web.ts",
      "#execution/worker/parseStreamInWorker.js": "/src/execution/worker/parseStreamInWorker.web.ts",
      "#execution/worker/parseUint8ArrayStreamInWorker.js": "/src/execution/worker/parseUint8ArrayStreamInWorker.web.ts",
      // Note: In tests (Node.js environment), use node version
      // In production, package.json "imports" handles browser/node resolution
      "#getOptionsFromResponse.constants.js": "/src/getOptionsFromResponse.constants.web.ts",
    },
  },
  build: {
    target: "esnext",
    lib: {
      entry: [
        "src/web-csv-toolbox.ts",
        "src/loadWASM.web.ts",
        "src/execution/worker/helpers/worker.web.ts",
        "src/execution/worker/helpers/worker.node.ts",
        "src/execution/worker/helpers/createWorker.web.ts",
        "src/execution/worker/helpers/createWorker.node.ts",
        "src/execution/worker/parseStringInWorker.web.ts",
        "src/execution/worker/parseStringInWorker.node.ts",
        "src/execution/worker/parseStringInWorkerWASM.web.ts",
        "src/execution/worker/parseStringInWorkerWASM.node.ts",
        "src/execution/worker/parseBinaryInWorker.web.ts",
        "src/execution/worker/parseBinaryInWorker.node.ts",
        "src/execution/worker/parseBinaryInWorkerWASM.web.ts",
        "src/execution/worker/parseBinaryInWorkerWASM.node.ts",
        "src/execution/worker/parseStreamInWorker.web.ts",
        "src/execution/worker/parseStreamInWorker.node.ts",
        "src/execution/worker/parseUint8ArrayStreamInWorker.web.ts",
        "src/execution/worker/parseUint8ArrayStreamInWorker.node.ts",
        "src/getOptionsFromResponse.constants.web.ts",
        "src/getOptionsFromResponse.constants.node.ts",
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
        // Prevent worker from being inlined as data URL
        assetFileNames: "[name][extname]",
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
    testTimeout: 10000,
    setupFiles: ["config/vitest.setup.ts"],
    coverage: {
      provider: "istanbul",
      include: ["src/**/*.ts"],
    },
    projects: [
      {
        test: {
          name: "node",
          include: ["src/**/*.node.{test,spec}.ts"],
          exclude: ["src/parseStringToArraySyncWASM.node.spec.ts"],
          environment: "node",
        },
        resolve: {
          alias: {
            "#execution/worker/createWorker.js": "/src/execution/worker/helpers/createWorker.node.ts",
            "#execution/worker/parseStringInWorker.js": "/src/execution/worker/parseStringInWorker.node.ts",
            "#execution/worker/parseStringInWorkerWASM.js": "/src/execution/worker/parseStringInWorkerWASM.node.ts",
            "#execution/worker/parseBinaryInWorker.js": "/src/execution/worker/parseBinaryInWorker.node.ts",
            "#execution/worker/parseBinaryInWorkerWASM.js": "/src/execution/worker/parseBinaryInWorkerWASM.node.ts",
            "#execution/worker/parseStreamInWorker.js": "/src/execution/worker/parseStreamInWorker.node.ts",
            "#execution/worker/parseUint8ArrayStreamInWorker.js": "/src/execution/worker/parseUint8ArrayStreamInWorker.node.ts",
            "#getOptionsFromResponse.constants.js": "/src/getOptionsFromResponse.constants.node.ts",
          },
        },
      },
      {
        extends: true,
        test: {
          name: "browser",
          include: ["src/**/*.browser.{test,spec}.ts"],
          browser: {
            enabled: true,
            provider: webdriverio(),
            instances: [{ browser: "chrome" }],
            headless: true,
          },
        },
        resolve: {
          alias: {
            "#execution/worker/createWorker.js": "/src/execution/worker/helpers/createWorker.web.ts",
            "#execution/worker/parseStringInWorker.js": "/src/execution/worker/parseStringInWorker.web.ts",
            "#execution/worker/parseStringInWorkerWASM.js": "/src/execution/worker/parseStringInWorkerWASM.web.ts",
            "#execution/worker/parseBinaryInWorker.js": "/src/execution/worker/parseBinaryInWorker.web.ts",
            "#execution/worker/parseBinaryInWorkerWASM.js": "/src/execution/worker/parseBinaryInWorkerWASM.web.ts",
            "#execution/worker/parseStreamInWorker.js": "/src/execution/worker/parseStreamInWorker.web.ts",
            "#execution/worker/parseUint8ArrayStreamInWorker.js": "/src/execution/worker/parseUint8ArrayStreamInWorker.web.ts",
            "#getOptionsFromResponse.constants.js": "/src/getOptionsFromResponse.constants.web.ts",
          },
        },
      },
      {
        test: {
          name: "shared",
          include: [
            "src/**/*.{test,spec}.ts",
            "!src/**/*.node.{test,spec}.ts",
            "!src/**/*.browser.{test,spec}.ts",
          ],
          environment: "node",
        },
        resolve: {
          alias: {
            "#execution/worker/createWorker.js": "/src/execution/worker/helpers/createWorker.node.ts",
            "#execution/worker/parseStringInWorker.js": "/src/execution/worker/parseStringInWorker.node.ts",
            "#execution/worker/parseStringInWorkerWASM.js": "/src/execution/worker/parseStringInWorkerWASM.node.ts",
            "#execution/worker/parseBinaryInWorker.js": "/src/execution/worker/parseBinaryInWorker.node.ts",
            "#execution/worker/parseBinaryInWorkerWASM.js": "/src/execution/worker/parseBinaryInWorkerWASM.node.ts",
            "#execution/worker/parseStreamInWorker.js": "/src/execution/worker/parseStreamInWorker.node.ts",
            "#execution/worker/parseUint8ArrayStreamInWorker.js": "/src/execution/worker/parseUint8ArrayStreamInWorker.node.ts",
            "#getOptionsFromResponse.constants.js": "/src/getOptionsFromResponse.constants.node.ts",
          },
        },
      },
    ],
  },
}));
