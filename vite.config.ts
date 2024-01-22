import dts from "vite-plugin-dts";
import { defineConfig } from "vitest/config";
import { Plugin } from "vite";
import rust_ from "@wasm-tool/rollup-plugin-rust";

function rust(options?: any): Plugin {
  const plugin = rust_(options) as Plugin;
  return {
    ...plugin,
    // If Rust code changes, restart the server.
    handleHotUpdate(ctx) {
      if (ctx.file.endsWith(".rs")) {
        console.log("Rust code changed");
        ctx.server.restart();
      }
    },
  };
}

export default defineConfig({
  build: {
    target: "esnext",
    lib: {
      entry: "src/web-csv-toolbox.ts",
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
    rust({
      experimental: {
        typescriptDeclarationDir: "./src/wasm",
      },
    }),
    dts({
      insertTypesEntry: true,
      outDir: "dist/types",
      exclude: ["**/*.spec.ts", "**/__tests__/**/*", "./src/wasm/target"],
      copyDtsFiles: true,
    }),
  ],
  test: {
    setupFiles: ["config/vitest.setup.ts"],
    browser: {
      name: "chrome",
    },
  },
});
