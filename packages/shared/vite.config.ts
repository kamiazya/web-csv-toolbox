import { codecovVitePlugin } from "@codecov/vite-plugin";
import type { Plugin } from "vite";
import dts from "vite-plugin-dts";
import { defineConfig } from "vitest/config";

export default defineConfig({
  build: {
    target: "esnext",
    lib: {
      entry: ["src/shared.ts"],
      formats: ["es"],
    },
    minify: true,
    rollupOptions: {
      output: {
        inlineDynamicImports: false,
        preserveModulesRoot: "src",
        exports: "named",
      },
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
    }),
    codecovVitePlugin({
      enableBundleAnalysis: process.env.CODECOV_TOKEN !== undefined,
      bundleName: "@web-csv-toolbox/shared",
      uploadToken: process.env.CODECOV_TOKEN,
      gitService: "github",
    }) as any as Plugin,
  ],
});
