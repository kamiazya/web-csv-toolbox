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
      // Aliases for dev server only - build uses resolve-imports plugin
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
      // Note: #/csv.wasm is handled differently during build via plugin
    },
  },
  build: {
    target: "esnext",
    lib: {
      entry: {
        "main.web": "src/main.web.ts", // Browser/Web version
        "main.node": "src/main.node.ts", // Node.js version
        "slim.web": "src/slim.web.ts", // Browser/Web version
        "slim.node": "src/slim.node.ts", // Node.js version
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
    sourcemap: false,
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
        "node:buffer",
      ],
      output: {
        inlineDynamicImports: false,
        preserveModules: true,
        preserveModulesRoot: "src",
        exports: "named",
        // Prevent worker from being inlined as data URL
        assetFileNames: "[name][extname]",
        // Separate Node.js files into dist/node/ directory
        entryFileNames: (chunkInfo) => {
          if (chunkInfo.name.includes('.node')) {
            return 'node/[name].js';
          }
          return '[name].js';
        },
        chunkFileNames: (chunkInfo) => {
          if (chunkInfo.name.includes('.node')) {
            return 'node/[name]-[hash].js';
          }
          return '[name]-[hash].js';
        },
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
      exclude: [
        "**/*.test.ts",
        "**/*.spec.ts",
        "**/*.test-d.ts",
        "**/__tests__/**/*",
        "examples/**/*",
        "benchmark/**/*",
      ],
      tsconfigPath: "./tsconfig.base.json",
      entryRoot: "src",
      rollupTypes: false,
      afterBuild: async () => {
        // Fix incorrect relative paths in generated .d.ts files
        const { readdir, readFile, writeFile, stat } = await import("node:fs/promises");
        const { join, relative, dirname } = await import("node:path");

        const distDir = join(process.cwd(), "dist");

        // Generate Deno-specific WASM loader in node/ directory
        const denoWasmContent = `// WASM file inlined as base64-encoded ArrayBuffer (Deno)
import { base64 } from "./web_csv_toolbox_wasm_bg.shared.wasm.js";
const binaryString = atob(base64);
const len = binaryString.length;
const bytes = new Uint8Array(len);
for (let i = 0; i < len; i++) {
  bytes[i] = binaryString.charCodeAt(i);
}
export default bytes.buffer || bytes;
//# sourceMappingURL=web_csv_toolbox_wasm_bg.deno.wasm.js.map
`;
        const nodeVirtualDir = join(distDir, "node", "_virtual");
        await import("node:fs/promises").then(({ mkdir }) => mkdir(nodeVirtualDir, { recursive: true }));

        const denoWasmPath = join(nodeVirtualDir, "web_csv_toolbox_wasm_bg.deno.wasm.js");
        await writeFile(denoWasmPath, denoWasmContent, "utf-8");

        console.log("[vite:dts] Generated Deno WASM loader: node/_virtual/web_csv_toolbox_wasm_bg.deno.wasm.js");

        async function fixDtsFiles(dir: string) {
          const files = await readdir(dir);

          for (const file of files) {
            const filePath = join(dir, file);
            const stats = await stat(filePath);

            if (stats.isDirectory()) {
              // Recursively process subdirectories
              await fixDtsFiles(filePath);
            } else if (file.endsWith('.d.ts')) {
              let content = await readFile(filePath, 'utf-8');
              const originalContent = content;

              // Replace long incorrect paths like '../../../../../../../src/X.ts' with proper relative paths
              // Match any number of '../' followed by 'src/'
              content = content.replace(
                /from ['"](?:\.\.\/)+src\/([^'"]+)['"]/g,
                (_match, modulePath) => {
                  // Remove .ts extension if present
                  const cleanPath = modulePath.replace(/\.ts$/, '');

                  // Calculate relative path from current file's directory to target
                  const currentDir = dirname(filePath);
                  const targetPath = join(distDir, cleanPath);
                  const relativePath = relative(currentDir, targetPath);

                  // Convert to forward slashes and add ./ prefix if needed
                  const normalizedPath = relativePath.replace(/\\/g, '/');
                  return `from '${normalizedPath.startsWith('.') ? normalizedPath : './' + normalizedPath}'`;
                }
              );

              if (content !== originalContent) {
                await writeFile(filePath, content, 'utf-8');
                const relPath = relative(distDir, filePath);
                console.log(`[vite:dts] Fixed paths in ${relPath}`);
              }
            }
          }
        }

        await fixDtsFiles(distDir);
      },
    }),
    codecovVitePlugin({
      enableBundleAnalysis: process.env.CI === 'true',
      bundleName: "web-csv-toolbox",
      ...(process.env.CODECOV_TOKEN && { uploadToken: process.env.CODECOV_TOKEN }),
      oidc: {
        useGitHubOIDC: !process.env.CODECOV_TOKEN, // Use OIDC only when token is not available
      },
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
            "#/wasm/loaders/loadWASM.js": "/src/wasm/loaders/loadWASM.node.ts",
            "#/wasm/loaders/loadWASMSync.js": "/src/wasm/loaders/loadWASMSync.node.ts",
            "#/worker/helpers/createWorker.js": "/src/worker/helpers/createWorker.node.ts",
            "#/utils/response/getOptionsFromResponse.constants.js":
              "/src/utils/response/getOptionsFromResponse.constants.node.ts",
            "#/utils/charset/getCharsetValidation.constants.js":
              "/src/utils/charset/getCharsetValidation.constants.node.ts",
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
            "#/wasm/loaders/loadWASM.js": "/src/wasm/loaders/loadWASM.web.ts",
            "#/wasm/loaders/loadWASMSync.js": "/src/wasm/loaders/loadWASMSync.web.ts",
            "#/worker/helpers/createWorker.js": "/src/worker/helpers/createWorker.web.ts",
            "#/utils/response/getOptionsFromResponse.constants.js":
              "/src/utils/response/getOptionsFromResponse.constants.web.ts",
            "#/utils/charset/getCharsetValidation.constants.js":
              "/src/utils/charset/getCharsetValidation.constants.web.ts",
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
            "#/wasm/loaders/loadWASM.js": "/src/wasm/loaders/loadWASM.node.ts",
            "#/wasm/loaders/loadWASMSync.js": "/src/wasm/loaders/loadWASMSync.node.ts",
            "#/worker/helpers/createWorker.js": "/src/worker/helpers/createWorker.node.ts",
            "#/utils/response/getOptionsFromResponse.constants.js":
              "/src/utils/response/getOptionsFromResponse.constants.node.ts",
            "#/utils/charset/getCharsetValidation.constants.js":
              "/src/utils/charset/getCharsetValidation.constants.node.ts",
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
            "#/wasm/loaders/loadWASM.js": "/src/wasm/loaders/loadWASM.node.ts",
            "#/wasm/loaders/loadWASMSync.js": "/src/wasm/loaders/loadWASMSync.node.ts",
            "#/worker/helpers/createWorker.js": "/src/worker/helpers/createWorker.node.ts",
            "#/utils/response/getOptionsFromResponse.constants.js":
              "/src/utils/response/getOptionsFromResponse.constants.node.ts",
            "#/utils/charset/getCharsetValidation.constants.js":
              "/src/utils/charset/getCharsetValidation.constants.node.ts",
          },
        },
      },
    ],
  },
}));
