import dts from "vite-plugin-dts";
import { defineConfig } from "vitest/config";

export default defineConfig({
  build: {
    lib: {
      entry: "src/index.ts",
      name: "CSV ",
      fileName: "index",
      formats: ["es", "umd"],
    },
    outDir: "lib",
    minify: false,
  },
  esbuild: {
    minifyIdentifiers: false,
    keepNames: true,
  },
  plugins: [dts({ rollupTypes: true })],
  test: {
    setupFiles: ["config/vitest.setup.ts"],
    exclude: ["node_modules", "lib", "**/*.deno.*.ts"],
    browser: {
      name: "chrome",
    },
  },
});
