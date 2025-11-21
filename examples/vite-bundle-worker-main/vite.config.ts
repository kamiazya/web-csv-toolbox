import { codecovVitePlugin } from '@codecov/vite-plugin';
import { defineConfig } from "vite";
import { resolve } from "node:path";

export default defineConfig({
  plugins: [
    codecovVitePlugin({
      enableBundleAnalysis: process.env.CODECOV_TOKEN !== undefined,
      bundleName: 'example-vite-bundle-worker-main',
      ...(process.env.CODECOV_TOKEN && { uploadToken: process.env.CODECOV_TOKEN }),
    }),
  ],
  resolve: {
    // Ensure browser build is selected for web-csv-toolbox
    conditions: ['browser', 'import', 'module', 'default'],
    mainFields: ['browser', 'module', 'main'],
  },
  build: {
    outDir: "dist",
    rollupOptions: {
      input: {
        main: resolve(__dirname, "index.html"),
      },
    },
  },
});
