import dts from "vite-plugin-dts";
import { defineConfig } from "vitest/config";
import wasmPack from "./config/vite-plugin-wasm-pack.ts";

export default defineConfig({
  build: {
    target: "esnext",
    lib: {
      entry: ["src/web-csv-toolbox.ts", "src/loadWASM.web.ts"],
      name: "CSV",
      formats: ["es", "cjs"],
      fileName: (format, entryName) => {
        const ext = format === "cjs" ? "cjs" : "js";
        return `${format}/${entryName}.${ext}`;
      },
    },
    minify: "terser",
    sourcemap: true,
    rollupOptions: {
      output: {
        inlineDynamicImports: false,
        preserveModules: true,
        preserveModulesRoot: "src",
        exports: "named",
      },
    },
  },
  esbuild: {
    minifyIdentifiers: false,
    keepNames: true,
    minifySyntax: true,
  },
  plugins: [
    wasmPack({
      crates: ["./web-csv-toolbox-wasm"],
    }),
    dts({
      insertTypesEntry: true,
      outDir: "dist/types",
      exclude: ["**/*.spec.ts", "**/__tests__/**/*"],
      copyDtsFiles: true,
    }),
  ],
  test: {
    setupFiles: ["config/vitest.setup.ts"],
    browser: {
      name: "chrome",
    },
    coverage: {
      enabled: true,
      provider: "istanbul", // use istanbul for browser coverage
      include: ["src/**/*.ts"],
      all: false,
    },
  },
});
