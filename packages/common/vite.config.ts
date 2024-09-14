import { codecovVitePlugin } from "@codecov/vite-plugin";
import type { Plugin } from "vite";
import dts from "vite-plugin-dts";
import { defineConfig } from "vitest/config";

export default defineConfig({
  build: {
    target: "esnext",
    lib: {
      entry: "src/common.ts",
      formats: ["es"],
    },
    minify: true,
    rollupOptions: {
      output: {
        inlineDynamicImports: false,
        preserveModulesRoot: "src",
        exports: "named",
      },
      external: ["@web-csv-toolbox/shared"],
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
    codecovVitePlugin({
      enableBundleAnalysis: process.env.CODECOV_TOKEN !== undefined,
      bundleName: "@web-csv-toolbox/common",
      uploadToken: process.env.CODECOV_TOKEN,
      gitService: "github",
    }) as any as Plugin,
  ],
});
