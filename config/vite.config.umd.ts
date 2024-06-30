import { codecovVitePlugin } from "@codecov/vite-plugin";
import { defineConfig } from "vitest/config";
import wasmPack from "./vite-plugin-wasm-pack.ts";

export default defineConfig({
  build: {
    target: "esnext",
    lib: {
      entry: "src/web-csv-toolbox.ts",
      name: "CSV",
      formats: ["umd"],
    },
    emptyOutDir: false,
    minify: "terser",
    sourcemap: true,
  },
  plugins: [
    wasmPack({
      crates: ["./web-csv-toolbox-wasm"],
      copyWasm: false,
    }),
    codecovVitePlugin({
      enableBundleAnalysis: process.env.CODECOV_TOKEN !== undefined,
      bundleName: "web-csv-toolbox",
      uploadToken: process.env.CODECOV_TOKEN,
    }),
  ],
  esbuild: {
    minifyIdentifiers: false,
    keepNames: true,
    minifySyntax: true,
  },
});
