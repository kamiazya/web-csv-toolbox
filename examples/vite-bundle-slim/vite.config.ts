import { codecovVitePlugin } from '@codecov/vite-plugin';
import { defineConfig } from 'vite';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [
    codecovVitePlugin({
      enableBundleAnalysis: process.env.CODECOV_TOKEN !== undefined,
      bundleName: 'example-vite-bundle-slim',
      uploadToken: process.env.CODECOV_TOKEN,
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
    },
    minify: true,
  },
  // Vite will automatically handle WASM files imported with ?url suffix
  assetsInclude: ['**/*.wasm'],
});
