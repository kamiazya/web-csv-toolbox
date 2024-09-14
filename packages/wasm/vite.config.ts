import { codecovVitePlugin } from "@codecov/vite-plugin";
import { defineConfig, type Plugin } from "vite";
import dts from "vite-plugin-dts";
import wasm from "vite-plugin-wasm";

// import wasmBase64Plugin from "../../config/vite-plugin-wasm-base64";

export default defineConfig({
  build: {
    target: "esnext",
    lib: {
      entry: ["src/wasm.ts", "src/wasm.browser.ts"],
      formats: ["es"],
    },
    minify: true,
    rollupOptions: {
      output: {
        inlineDynamicImports: false,
        preserveModulesRoot: "src",
        exports: "named",
      },
      external: ["@web-csv-toolbox/common"],
    },
    outDir: "dist",
  },
  esbuild: {
    minifyIdentifiers: false,
    keepNames: true,
    minifySyntax: true,
  },
  plugins: [
    wasm(),
    dts({
      rollupTypes: true,
    }),
    codecovVitePlugin({
      enableBundleAnalysis: process.env.CODECOV_TOKEN !== undefined,
      bundleName: "@web-csv-toolbox/wasm",
      uploadToken: process.env.CODECOV_TOKEN,
      gitService: "github",
    }) as any as Plugin,
  ],
});
