import { readFile } from "node:fs/promises";
import type { Plugin } from "vite";

/**
 * Vite plugin to import WASM files as ArrayBuffer for synchronous initialization.
 *
 * This plugin allows importing WASM files with `?arraybuffer` suffix,
 * which inlines the WASM file as a base64-encoded ArrayBuffer.
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
      // Preserve the ?arraybuffer query parameter during resolution
      if (source.includes("?arraybuffer")) {
        // Let Vite resolve the base path first
        const baseSource = source.replace(/\?arraybuffer$/, "");
        const resolved = await this.resolve(baseSource, importer, {
          ...options,
          skipSelf: true,
        });

        if (resolved && !resolved.external) {
          // Skip virtual modules (those starting with \0)
          if (resolved.id.startsWith("\0")) {
            return null;
          }
          // Add back the query parameter to the resolved id
          // Use \0 prefix to mark as virtual module and skip further processing
          return "\0arraybuffer:" + resolved.id;
        }
      }
      return null;
    },

    async load(id) {
      // Check if this is our virtual arraybuffer module
      if (!id.startsWith("\0arraybuffer:")) {
        return null;
      }

      // Extract the actual file path from the virtual module id
      const filePath = id.replace(/^\0arraybuffer:/, "");

      // Only process .wasm files
      if (!filePath.endsWith(".wasm")) {
        return null;
      }

      try {
        // Read the WASM file
        const buffer = await readFile(filePath);

        // Convert to base64
        const base64 = buffer.toString("base64");

        // Return as JavaScript module that exports an ArrayBuffer
        return `
// WASM file inlined as base64-encoded ArrayBuffer
const base64 = "${base64}";
const binaryString = atob(base64);
const bytes = new Uint8Array(binaryString.length);
for (let i = 0; i < binaryString.length; i++) {
  bytes[i] = binaryString.charCodeAt(i);
}
export default bytes.buffer;
`;
      } catch (error) {
        console.error(`Failed to load WASM file: ${filePath}`, error);
        return null;
      }
    },
  };
}
