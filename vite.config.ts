import { codecovVitePlugin } from "@codecov/vite-plugin";
import { webdriverio } from "@vitest/browser-webdriverio";
import dts from "vite-plugin-dts";
import { defineConfig } from "vitest/config";
import wasmPack from "./config/vite-plugin-wasm-pack.ts";

export default defineConfig(({ command }) => ({
  resolve: {
    alias: {
      // Aliases for testing only - production uses package.json "imports"
      "#execution/worker/createWorker.js": "/src/worker/helpers/createWorker.web.ts",
      "#execution/worker/parseStringInWorker.js": "/src/parser/execution/worker/parseStringInWorker.ts",
      "#execution/worker/parseStringInWorkerWASM.js": "/src/parser/execution/worker/parseStringInWorkerWASM.ts",
      "#execution/worker/parseBinaryInWorker.js": "/src/parser/execution/worker/parseBinaryInWorker.ts",
      "#execution/worker/parseBinaryInWorkerWASM.js": "/src/parser/execution/worker/parseBinaryInWorkerWASM.ts",
      "#execution/worker/parseStreamInWorker.js": "/src/parser/execution/worker/parseStreamInWorker.ts",
      "#execution/worker/parseUint8ArrayStreamInWorker.js": "/src/parser/execution/worker/parseUint8ArrayStreamInWorker.ts",
      "#execution/worker/parseUint8ArrayStreamInWorkerWASM.js": "/src/parser/execution/worker/parseUint8ArrayStreamInWorkerWASM.ts",
      // Note: In tests (Node.js environment), use node version
      // In production, package.json "imports" handles browser/node resolution
      "#getOptionsFromResponse.constants.js": "/src/utils/response/getOptionsFromResponse.constants.web.ts",
      "#getCharsetValidation.constants.js": "/src/utils/charset/getCharsetValidation.constants.web.ts",
    },
  },
  build: {
    target: "esnext",
    lib: {
      entry: [
        "src/web-csv-toolbox.ts",
        "src/wasm/loadWASM.web.ts",
        "src/worker.web.ts",
        "src/worker.node.ts",
        "src/worker/helpers/createWorker.web.ts",
        "src/worker/helpers/createWorker.node.ts",
        "src/parser/execution/worker/parseStringInWorker.ts",
        "src/parser/execution/worker/parseStringInWorkerWASM.ts",
        "src/parser/execution/worker/parseBinaryInWorker.ts",
        "src/parser/execution/worker/parseBinaryInWorkerWASM.ts",
        "src/parser/execution/worker/parseStreamInWorker.ts",
        "src/parser/execution/worker/parseUint8ArrayStreamInWorker.ts",
        "src/parser/execution/worker/parseUint8ArrayStreamInWorkerWASM.ts",
        "src/utils/response/getOptionsFromResponse.constants.web.ts",
        "src/utils/response/getOptionsFromResponse.constants.node.ts",
        "src/utils/charset/getCharsetValidation.constants.web.ts",
        "src/utils/charset/getCharsetValidation.constants.node.ts",
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
            "#execution/worker/createWorker.js": "/src/worker/helpers/createWorker.node.ts",
            "#execution/worker/parseStringInWorker.js": "/src/parser/execution/worker/parseStringInWorker.ts",
            "#execution/worker/parseStringInWorkerWASM.js": "/src/parser/execution/worker/parseStringInWorkerWASM.ts",
            "#execution/worker/parseBinaryInWorker.js": "/src/parser/execution/worker/parseBinaryInWorker.ts",
            "#execution/worker/parseBinaryInWorkerWASM.js": "/src/parser/execution/worker/parseBinaryInWorkerWASM.ts",
            "#execution/worker/parseStreamInWorker.js": "/src/parser/execution/worker/parseStreamInWorker.ts",
            "#execution/worker/parseUint8ArrayStreamInWorker.js": "/src/parser/execution/worker/parseUint8ArrayStreamInWorker.ts",
            "#getOptionsFromResponse.constants.js": "/src/utils/response/getOptionsFromResponse.constants.node.ts",
            "#getCharsetValidation.constants.js": "/src/utils/charset/getCharsetValidation.constants.node.ts",
          },
        },
      },
      {
        extends: true,
        test: {
          name: "browser",
          include: ["src/**/*.browser.{test,spec}.ts"],
          testTimeout: 60000, // 60 seconds for browser tests (property-based tests with workers need more time)
          browser: {
            enabled: true,
            provider: webdriverio(),
            instances: (() => {
              // Windows: Chrome, Firefox, Edge
              if (process.platform === 'win32') {
                return [
                  { browser: "chrome" },
                  { browser: "firefox" },
                  { browser: "edge" },
                ];
              }
              // Default (Linux/macOS): Chrome, Firefox
              // Edge not supported on Linux, Safari headless not supported on macOS
              return [
                { browser: "chrome" },
                { browser: "firefox" },
              ];
            })(),
            headless: true,
          },
        },
        resolve: {
          alias: {
            "#execution/worker/createWorker.js": "/src/worker/helpers/createWorker.web.ts",
            "#execution/worker/parseStringInWorker.js": "/src/parser/execution/worker/parseStringInWorker.ts",
            "#execution/worker/parseStringInWorkerWASM.js": "/src/parser/execution/worker/parseStringInWorkerWASM.ts",
            "#execution/worker/parseBinaryInWorker.js": "/src/parser/execution/worker/parseBinaryInWorker.ts",
            "#execution/worker/parseBinaryInWorkerWASM.js": "/src/parser/execution/worker/parseBinaryInWorkerWASM.ts",
            "#execution/worker/parseStreamInWorker.js": "/src/parser/execution/worker/parseStreamInWorker.ts",
            "#execution/worker/parseUint8ArrayStreamInWorker.js": "/src/parser/execution/worker/parseUint8ArrayStreamInWorker.ts",
            "#getOptionsFromResponse.constants.js": "/src/utils/response/getOptionsFromResponse.constants.web.ts",
            "#getCharsetValidation.constants.js": "/src/utils/charset/getCharsetValidation.constants.web.ts",
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
            "#execution/worker/createWorker.js": "/src/worker/helpers/createWorker.node.ts",
            "#execution/worker/parseStringInWorker.js": "/src/parser/execution/worker/parseStringInWorker.ts",
            "#execution/worker/parseStringInWorkerWASM.js": "/src/parser/execution/worker/parseStringInWorkerWASM.ts",
            "#execution/worker/parseBinaryInWorker.js": "/src/parser/execution/worker/parseBinaryInWorker.ts",
            "#execution/worker/parseBinaryInWorkerWASM.js": "/src/parser/execution/worker/parseBinaryInWorkerWASM.ts",
            "#execution/worker/parseStreamInWorker.js": "/src/parser/execution/worker/parseStreamInWorker.ts",
            "#execution/worker/parseUint8ArrayStreamInWorker.js": "/src/parser/execution/worker/parseUint8ArrayStreamInWorker.ts",
            "#getOptionsFromResponse.constants.js": "/src/utils/response/getOptionsFromResponse.constants.node.ts",
            "#getCharsetValidation.constants.js": "/src/utils/charset/getCharsetValidation.constants.node.ts",
          },
        },
      },
      {
        test: {
          name: "typecheck",
          include: ["src/**/*.test-d.ts"],
          typecheck: {
            enabled: true,
          },
        },
      },
    ],
  },
}));
