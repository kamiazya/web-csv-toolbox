import { Plugin } from "vite";
import { defineConfig } from "vitest/config";
import rust from "@wasm-tool/rollup-plugin-rust";

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
    rust({
      inlineWasm: true,
    }) as Plugin,
  ],
  esbuild: {
    minifyIdentifiers: false,
    keepNames: true,
    minifySyntax: true,
  },
});
