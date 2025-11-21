import { codecovVitePlugin } from '@codecov/vite-plugin';
import { defineConfig } from "vite";
import { resolve } from "node:path";

export default defineConfig({
  plugins: [
    codecovVitePlugin({
      enableBundleAnalysis: process.env.CODECOV_TOKEN !== undefined,
      bundleName: 'example-vite-bundle-worker-slim',
      ...(process.env.CODECOV_TOKEN && { uploadToken: process.env.CODECOV_TOKEN }),
    }),
  ],
  build: {
    outDir: "dist",
    rollupOptions: {
      input: {
        main: resolve(__dirname, "index.html"),
      },
    },
  },
  // Vite will automatically handle WASM files imported with ?url suffix
  assetsInclude: ['**/*.wasm'],
});
