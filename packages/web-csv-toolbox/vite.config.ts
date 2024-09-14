import { codecovVitePlugin } from "@codecov/vite-plugin";
import type { Plugin } from "vite";
import dts from "vite-plugin-dts";
import { defineConfig } from "vitest/config";

export default defineConfig({
  build: {
    target: "esnext",
    lib: {
      entry: "src/web-csv-toolbox.ts",
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
        "@web-csv-toolbox/common",
        "@web-csv-toolbox/parser",
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
    dts(),
    codecovVitePlugin({
      enableBundleAnalysis: process.env.CODECOV_TOKEN !== undefined,
      bundleName : "@web-csv-toolbox/shared",
      uploadToken : process.env.CODECOV_TOKEN,
      gitService : "github",
    }) as any as Plugin,
  ],
});
