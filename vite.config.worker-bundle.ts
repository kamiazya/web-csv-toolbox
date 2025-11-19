import { defineConfig } from "vite";
import { resolveImportsPlugin } from "./config/vite-plugin-resolve-imports.ts";
import { wasmArrayBuffer } from "./config/vite-plugin-wasm-arraybuffer.ts";
import wasmPack from "./config/vite-plugin-wasm-pack.ts";

/**
 * Bundled worker build configuration
 * This creates single-file bundles for web and node workers
 * that include all dependencies for easier deployment
 *
 * Usage:
 *   TARGET=web VARIANT=main pnpm build:worker-bundle    # builds worker.web.bundle.js
 *   TARGET=node VARIANT=main pnpm build:worker-bundle   # builds worker.node.bundle.js
 *   TARGET=web VARIANT=slim pnpm build:worker-bundle    # builds worker.slim.web.bundle.js
 *   TARGET=node VARIANT=slim pnpm build:worker-bundle   # builds worker.slim.node.bundle.js
 */

const target = process.env.TARGET || "web";
const variant = process.env.VARIANT || "main";
const isNode = target === "node";
const isSlim = variant === "slim";
const entryFile = isNode ? "src/worker.node.ts" : "src/worker.web.ts";
const outputFile = isSlim
  ? (isNode ? "worker.slim.node.bundle" : "worker.slim.web.bundle")
  : (isNode ? "worker.node.bundle" : "worker.web.bundle");
// Don't clear output dir - preserve files from build:js
const emptyOutDir = false;

export default defineConfig({
  define: {
    __VARIANT__: JSON.stringify(variant),
  },
  assetsInclude: ["**/*.wasm", "**/*.wasm?*"],
  optimizeDeps: {
    exclude: ["web-csv-toolbox-wasm"],
  },
  resolve: {
    alias: {
      "@": "/src",
    },
  },
  build: {
    target: "esnext",
    emptyOutDir,
    lib: {
      entry: entryFile,
      name: "CSV_Worker",
      formats: ["es"],
      fileName: () => `${outputFile}.js`,
    },
    minify: "terser",
    sourcemap: true,
    rollupOptions: {
      onwarn(warning, warn) {
        // Suppress WASM file resolution warnings (intentional runtime resolution)
        if (
          warning.message?.includes("csv.wasm") ||
          warning.message?.includes("web_csv_toolbox_wasm_bg.wasm")
        ) {
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
        // Bundle everything into a single file
        inlineDynamicImports: true,
        exports: "named",
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
  ],
});
