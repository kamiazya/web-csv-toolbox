import { codecovVitePlugin } from '@codecov/vite-plugin';
import { defineConfig } from "vite";
import { resolve } from "node:path";

export default defineConfig({
  plugins: [
    codecovVitePlugin({
      enableBundleAnalysis: process.env.CI === 'true',
      bundleName: 'example-vite-bundle-worker-slim',
      oidc: {
        useGitHubOIDC: true,
      },
    }),
  ],
  build: {
    outDir: "dist",
    rollupOptions: {
      input: {
        main: resolve(__dirname, "index.html"),
      },
      external: (id) => {
        // Exclude Node.js-specific files from browser bundle
        // These files are in dist/node/ but Vite still discovers them via package.json imports
        return id.includes('/node/') || id.includes('/node\\');
      },
    },
  },
  // Vite will automatically handle WASM files imported with ?url suffix
  assetsInclude: ['**/*.wasm'],
});
