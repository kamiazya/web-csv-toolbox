import { dataToEsm } from '@rollup/pluginutils';
import { readFile } from "fs/promises";
import dts from "vite-plugin-dts";
import topLevelAwait from "vite-plugin-top-level-await";
import wasm from "vite-plugin-wasm";
import tsconfigPaths from 'vite-tsconfig-paths';
import { defineConfig } from "vitest/config";

export default defineConfig({
  build: {
    target: "esnext",
    lib: {
      entry: ["src/wasm.ts", "src/wasm.browser.ts"],
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
    tsconfigPaths(),
    {
      name: 'vite-plugin-base64',
      async transform(source, id) {
          if (!id.endsWith('.wasm')) return
          const file = await readFile(id);
          const base64 = file.toString('base64');
          const code = `data:application/wasm;base64,${base64}";`;
          return dataToEsm(code)
      },
    },
    wasm(),
    topLevelAwait(),
    dts({
      rollupTypes: true,
      outDir: "dist",
    }),
  ],
});
