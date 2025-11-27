import { defineConfig } from 'vite';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      // Resolve worker import for ?url suffix
      'web-csv-toolbox/worker': resolve(__dirname, '../../dist/worker.web.js'),
    },
  },
  build: {
    outDir: 'dist',
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
      },
      external: (id) => {
        // Exclude Node.js-specific files from browser bundle
        return id.includes('/node/') || id.includes('/node\\');
      },
    },
    minify: true,
  },
  server: {
    port: 5173,
  },
});
