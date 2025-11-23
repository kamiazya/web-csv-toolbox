import { codecovVitePlugin } from '@codecov/vite-plugin';
import { defineConfig } from 'vite';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [
    codecovVitePlugin({
      enableBundleAnalysis: process.env.CI === 'true',
      bundleName: 'example-vite-bundle-slim',
      oidc: {
        useGitHubOIDC: true,
      },
    }),
  ],
  build: {
    outDir: 'dist',
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
      },
      output: {
        entryFileNames: 'bundle.js',
      },
      external: (id) => {
        // Exclude Node.js-specific files from browser bundle
        // These files are in dist/node/ but Vite still discovers them via package.json imports
        return id.includes('/node/') || id.includes('/node\\');
      },
    },
    minify: true,
  },
  // Vite will automatically handle WASM files imported with ?url suffix
  assetsInclude: ['**/*.wasm'],
});
