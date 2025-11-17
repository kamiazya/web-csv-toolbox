import { readFile } from "node:fs/promises";
import path from "node:path";
import type { Plugin } from "vite";

/**
 * Vite plugin to import WASM files as ArrayBuffer for synchronous initialization.
 *
 * This plugin allows importing WASM files with `?arraybuffer` suffix,
 * which inlines the WASM file as a base64-encoded ArrayBuffer.
 *
 * The generated code is optimized based on the importer file path:
 * - `.node.ts` or `.node.js` files → Node.js-specific code (Buffer.from)
 * - Other files → Browser-specific code (Uint8Array.fromBase64)
 *
 * Generated files:
 * - `xxx.node.wasm.js` - Node.js environment (uses Buffer.from)
 * - `xxx.web.wasm.js` - Browser environment (uses Uint8Array.fromBase64)
 * - `xxx.shared.wasm.js` - Shared base64 data (imported by both)
 *
 * @example
 * ```ts
 * import wasmBuffer from 'module.wasm?arraybuffer';
 * initSync(wasmBuffer); // Synchronous WASM initialization
 * ```
 */
export function wasmArrayBuffer(): Plugin {
  return {
    name: "vite-plugin-wasm-arraybuffer",
    enforce: "pre", // Run before other plugins to ensure we handle ?arraybuffer first

    async resolveId(source, importer, options) {
      // Handle shared module imports (from environment-specific modules)
      if (source.startsWith("\0_virtual/") && source.includes(".shared.wasm")) {
        console.log(`[vite-plugin-wasm-arraybuffer] resolveId for shared module: ${source}`);
        return source; // Return as-is to preserve the virtual module ID
      }

      // Handle #/csv.wasm imports
      if (source === "#/csv.wasm") {
        console.log(`[vite-plugin-wasm-arraybuffer] resolveId called for #/csv.wasm import: ${source}, importer=${importer}`);
        // Detect target environment from importer path
        const isNodeTarget = /\.node\.(ts|js)/.test(importer || "");
        const env = isNodeTarget ? "node" : "web";
        const virtualId = `\0_virtual/web_csv_toolbox_wasm_bg.${env}.wasm`;
        console.log(`[vite-plugin-wasm-arraybuffer] returning virtualId for #/csv.wasm: ${virtualId}`);
        return virtualId;
      }

      // Preserve the ?arraybuffer query parameter during resolution
      if (source.endsWith("?arraybuffer")) {
        console.log(`[vite-plugin-wasm-arraybuffer] resolveId called: source=${source}, importer=${importer}`);
        // Let Vite resolve the base path first
        const baseSource = source.replace(/\?arraybuffer$/, "");
        const resolved = await this.resolve(baseSource, importer, {
          ...options,
          skipSelf: true,
        });

        console.log(`[vite-plugin-wasm-arraybuffer] resolved: ${JSON.stringify(resolved)}`);

        if (resolved && !resolved.external) {
          // resolved.id may have lost the ?arraybuffer query, but we keep the original source info
          // Use resolved.id without \0 prefix, or fallback to original source without ?arraybuffer
          let filePath = resolved.id;
          if (filePath.startsWith("\0")) {
            // Remove \0 prefix added by other plugins
            filePath = filePath.substring(1);
          }

          // Detect target environment from importer path
          // If importer contains .node.ts or .node.js, it's for Node.js
          const isNodeTarget = /\.node\.(ts|js)/.test(importer || "");
          // Include environment in virtual module ID to generate separate modules
          const env = isNodeTarget ? "node" : "web";
          // Generate virtual ID with file path structure for proper output naming
          const wasmFileName = filePath.replace(/^.*\//, "").replace(".wasm", ""); // Extract filename without extension
          const virtualId = `\0_virtual/${wasmFileName}.${env}.wasm`;
          console.log(`[vite-plugin-wasm-arraybuffer] returning virtualId: ${virtualId}`);
          return virtualId;
        }
      }
      return null;
    },

    async load(id) {
      // Check if this is our virtual arraybuffer module or shared module
      if (!id.startsWith("\0_virtual/")) {
        return null;
      }

      console.log(`[vite-plugin-wasm-arraybuffer] load called: id=${id}`);

      // Handle shared module (base64 data only)
      if (id.includes(".shared.wasm")) {
        // Extract filename: \0_virtual/web_csv_toolbox_wasm_bg.shared.wasm -> web_csv_toolbox_wasm_bg
        const match = id.match(/\0_virtual\/(.+)\.shared\.wasm/);
        if (!match) {
          console.log(`[vite-plugin-wasm-arraybuffer] invalid shared module format: ${id}`);
          return null;
        }
        const baseName = match[1];
        console.log(`[vite-plugin-wasm-arraybuffer] loading shared module: ${baseName}`);

        // Resolve absolute path
        const absolutePath = path.join(process.cwd(), "node_modules", "web-csv-toolbox-wasm", `${baseName}.wasm`);
        console.log(`[vite-plugin-wasm-arraybuffer] absolutePath=${absolutePath}`);

        try {
          const buffer = await readFile(absolutePath);
          const base64 = buffer.toString("base64");

          return `
// WASM file base64 data (shared across environments)
export const base64 = "${base64}";
`;
        } catch (error) {
          console.error(`[vite-plugin-wasm-arraybuffer] Failed to load WASM file: ${absolutePath}`, error);
          return null;
        }
      }

      // Handle environment-specific module
      // Extract environment from virtual module id
      // Format: \0_virtual/xxx.node.wasm or \0_virtual/xxx.web.wasm
      const match = id.match(/\0_virtual\/(.+)\.(node|web)\.wasm/);
      if (!match) {
        console.log(`[vite-plugin-wasm-arraybuffer] invalid format: ${id}`);
        return null;
      }

      const baseName = match[1];
      const env = match[2]; // "node" or "web"

      console.log(`[vite-plugin-wasm-arraybuffer] env=${env}, baseName=${baseName}`);

      const isNodeTarget = env === "node";
      console.log(`[vite-plugin-wasm-arraybuffer] isNodeTarget=${isNodeTarget}`);

      // Generate import path for shared module
      const sharedModuleId = `\0_virtual/${baseName}.shared.wasm`;

      // Return as JavaScript module that exports an ArrayBuffer
      // Import shared base64 data and decode it based on environment
      if (isNodeTarget) {
        // Node.js build: Only include Buffer.from code
        return `
// WASM file inlined as base64-encoded ArrayBuffer (Node.js optimized)
import { base64 } from "${sharedModuleId}";
const bytes = Buffer.from(base64, 'base64');
export default bytes.buffer || bytes;
`;
      } else {
        // Browser build: Use modern Uint8Array.fromBase64 API
        return `
// WASM file inlined as base64-encoded ArrayBuffer (Browser optimized)
import { base64 } from "${sharedModuleId}";
// Uses Uint8Array.fromBase64 (Chrome 126+, Firefox 133+, Safari 18.2+, Edge 126+)
// For older browsers, users should use a polyfill: https://github.com/tc39/proposal-arraybuffer-base64
const bytes = Uint8Array.fromBase64(base64);
export default bytes.buffer;
`;
      }
    },
  };
}
