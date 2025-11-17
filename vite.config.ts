import { codecovVitePlugin } from "@codecov/vite-plugin";
import { webdriverio } from "@vitest/browser-webdriverio";
import dts from "vite-plugin-dts";
import { defineConfig } from "vitest/config";
import { resolveImportsPlugin } from "./config/vite-plugin-resolve-imports.ts";
import { wasmArrayBuffer } from "./config/vite-plugin-wasm-arraybuffer.ts";
import wasmPack from "./config/vite-plugin-wasm-pack.ts";

export default defineConfig(({ command }) => ({
  assetsInclude: ["**/*.wasm", "**/*.wasm?*"],
  optimizeDeps: {
    exclude: ["web-csv-toolbox-wasm"],
  },
  resolve: {
    alias: {
      "@": "/src",
      // Aliases for development only - build uses relative imports
      ...(command === "serve"
        ? {
            "#/wasm/loaders/loadWASM.js": "/src/wasm/loaders/loadWASM.web.ts",
            "#/wasm/loaders/loadWASMSync.js": "/src/wasm/loaders/loadWASMSync.web.ts",
            "#/worker/helpers/createWorker.js": "/src/worker/helpers/createWorker.web.ts",
            "#/utils/response/getOptionsFromResponse.constants.js":
              "/src/utils/response/getOptionsFromResponse.constants.web.ts",
            "#/utils/charset/getCharsetValidation.constants.js":
              "/src/utils/charset/getCharsetValidation.constants.web.ts",
          }
        : {}),
    },
  },
  build: {
    target: "esnext",
    lib: {
      entry: {
        "main.web": "src/main.web.ts", // Browser/Web version
        "main.node": "src/main.node.ts", // Node.js version
        "lite.web": "src/lite.web.ts", // Browser/Web version
        "lite.node": "src/lite.node.ts", // Node.js version
        "wasm/loaders/loadWASM.web": "src/wasm/loaders/loadWASM.web.ts",
        "wasm/loaders/loadWASM.node": "src/wasm/loaders/loadWASM.node.ts",
        "wasm/loaders/loadWASMSync.web": "src/wasm/loaders/loadWASMSync.web.ts",
        "wasm/loaders/loadWASMSync.node": "src/wasm/loaders/loadWASMSync.node.ts",
        "worker.web": "src/worker.web.ts",
        "worker.node": "src/worker.node.ts",
        "worker/helpers/createWorker.web": "src/worker/helpers/createWorker.web.ts",
        "worker/helpers/createWorker.node": "src/worker/helpers/createWorker.node.ts",
        "parser/execution/worker/parseStringInWorker": "src/parser/execution/worker/parseStringInWorker.ts",
        "parser/execution/worker/parseStringInWorkerWASM": "src/parser/execution/worker/parseStringInWorkerWASM.ts",
        "parser/execution/worker/parseBinaryInWorker": "src/parser/execution/worker/parseBinaryInWorker.ts",
        "parser/execution/worker/parseBinaryInWorkerWASM": "src/parser/execution/worker/parseBinaryInWorkerWASM.ts",
        "parser/execution/worker/parseStreamInWorker": "src/parser/execution/worker/parseStreamInWorker.ts",
        "parser/execution/worker/parseUint8ArrayStreamInWorker": "src/parser/execution/worker/parseUint8ArrayStreamInWorker.ts",
        "parser/execution/worker/parseUint8ArrayStreamInWorkerWASM": "src/parser/execution/worker/parseUint8ArrayStreamInWorkerWASM.ts",
        "utils/response/getOptionsFromResponse.constants.web": "src/utils/response/getOptionsFromResponse.constants.web.ts",
        "utils/response/getOptionsFromResponse.constants.node": "src/utils/response/getOptionsFromResponse.constants.node.ts",
        "utils/charset/getCharsetValidation.constants.web": "src/utils/charset/getCharsetValidation.constants.web.ts",
        "utils/charset/getCharsetValidation.constants.node": "src/utils/charset/getCharsetValidation.constants.node.ts",
      },
      name: "CSV",
      formats: ["es"],
      fileName: (_format, entryName) => {
        return `${entryName}.js`;
      },
    },
    minify: "terser",
    sourcemap: true,
    rollupOptions: {
      onwarn(warning, warn) {
        // Suppress WASM file resolution warnings (intentional runtime resolution)
        if (warning.message?.includes("csv.wasm") ||
            warning.message?.includes("web_csv_toolbox_wasm_bg.wasm")) {
          return;
        }
        warn(warning);
      },
      external: [
        "node:worker_threads",
        "node:url",
        "node:path",
        "node:fs/promises",
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
    resolveImportsPlugin(), // Resolve # imports to relative paths during build
    wasmArrayBuffer(), // Must come before wasmPack to handle ?arraybuffer imports
    wasmPack({
      crates: ["./web-csv-toolbox-wasm"],
    }),
    dts({
      insertTypesEntry: true,
      outDir: "dist",
      exclude: ["**/*.test.ts", "**/*.spec.ts", "**/*.test-d.ts", "**/__tests__/**/*"],
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
    server: {
      deps: {
        inline: ["web-csv-toolbox-wasm"],
      },
    },
    coverage: {
      provider: "istanbul",
      include: ["src/**/*.ts"],
    },
    projects: [
      {
        test: {
          name: "node",
          include: ["src/**/*.node.{test,spec}.ts"],
          environment: "node",
        },
        resolve: {
          alias: {
            "@": "/src",
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
            "@": "/src",
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
            "@": "/src",
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
        resolve: {
          alias: {
            "@": "/src",
          },
        },
      },
    ],
  },
}));
