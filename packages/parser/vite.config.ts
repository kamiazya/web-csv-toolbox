import dts from "vite-plugin-dts";
import { defineConfig } from "vitest/config";

export default defineConfig({
  build: {
    target: "esnext",
    lib: {
      entry: "src/parser.ts",
      formats: ["es", "cjs"],
    },
    minify: "terser",
    rollupOptions: {
      output: {
        inlineDynamicImports: false,
        preserveModulesRoot: "src",
        exports: "named",
      },
      external: [
        "@web-csv-toolbox/shared",
        "@web-csv-toolbox/common",
        "@web-csv-toolbox/wasm",
      ],
    },
    outDir: "dist",
  },
  esbuild: {
    minifyIdentifiers: false,
    keepNames: true,
    minifySyntax: true,
  },
  plugins: [
    dts({
      rollupTypes: true,
      outDir: "dist",
    }),
  ],
});
