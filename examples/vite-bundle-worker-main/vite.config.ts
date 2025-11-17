import { defineConfig, Plugin } from "vite";
import { copyFileSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

// Plugin to redirect Node.js WASM imports to Web versions
function redirectNodeToWeb(): Plugin {
  return {
    name: 'redirect-node-to-web',
    load(id) {
      // If loading a .node.wasm.js file, load the .web.wasm.js version instead
      if (id.includes('web_csv_toolbox_wasm_bg.node.wasm.js')) {
        const webVersion = id.replace('.node.wasm.js', '.web.wasm.js');
        try {
          return readFileSync(webVersion, 'utf-8');
        } catch (e) {
          console.error('Failed to load web version:', e);
          return null;
        }
      }
      return null;
    },
  };
}

export default defineConfig({
  resolve: {
    // Ensure browser build is selected for web-csv-toolbox
    conditions: ['browser', 'import', 'module', 'default'],
    mainFields: ['browser', 'module', 'main'],
    alias: {
      // Force web-csv-toolbox to use browser build
      'web-csv-toolbox': resolve(__dirname, '../../dist/main.web.js'),
    },
  },
  build: {
    outDir: "dist",
    rollupOptions: {
      input: {
        main: resolve(__dirname, "index.html"),
      },
    },
  },
  plugins: [
    // redirectNodeToWeb(), // Testing if exports field alone fixes the issue
    {
      name: "copy-worker-bundle",
      closeBundle() {
        // Copy bundled worker file (single file with all dependencies)
        const workerPath = resolve(__dirname, "../../dist/worker.web.bundle.js");
        const workerDest = resolve(__dirname, "dist/worker.js");
        try {
          copyFileSync(workerPath, workerDest);
          console.log("✓ Copied worker.web.bundle.js to dist/worker.js");
        } catch (error) {
          console.warn("Warning: Could not copy worker bundle:", error);
        }

        // Copy WASM file for runtime loading
        const wasmPath = resolve(__dirname, "../../dist/csv.wasm");
        const wasmDest = resolve(__dirname, "dist/csv.wasm");
        try {
          copyFileSync(wasmPath, wasmDest);
          console.log("✓ Copied csv.wasm to dist/");
        } catch (error) {
          console.warn("Warning: Could not copy csv.wasm:", error);
        }
      },
    },
  ],
});
