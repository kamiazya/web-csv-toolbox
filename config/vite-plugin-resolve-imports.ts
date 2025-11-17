import type { Plugin } from "vite";
import path from "node:path";

/**
 * Vite plugin to resolve # imports to relative paths during build.
 *
 * This plugin transforms package-internal imports (starting with #/) to relative paths
 * based on the current file's location and target environment.
 *
 * Why this is needed:
 * - During development, # imports are resolved via vite.config.ts aliases
 * - During build, we want to generate standalone files that don't depend on package.json "imports"
 * - Built files should use relative imports that work in any environment
 *
 * The plugin:
 * 1. Detects # imports during the resolveId phase
 * 2. Maps them to the correct file based on environment (.node or .web)
 * 3. Transforms them to relative paths in the output
 */
export function resolveImportsPlugin(): Plugin {
  // Track which modules belong to which entry
  const moduleToEntry = new Map<string, string>();
  let currentEntry: string | null = null;

  return {
    name: "vite-plugin-resolve-imports",
    enforce: "pre",

    buildStart() {
      // Reset state for each build
      moduleToEntry.clear();
      currentEntry = null;
    },

    async resolveId(source, importer, options) {
      // Track entry points - store the actual source file path
      if (options.isEntry && source) {
        const normalizedSource = source.startsWith("/") ? source : path.join(process.cwd(), source);
        console.log(`[resolve-imports] Entry point: ${normalizedSource}`);
        currentEntry = normalizedSource;
        moduleToEntry.set(normalizedSource, normalizedSource);
        return null; // Let Vite handle the actual resolution
      }

      // Track all module resolutions to propagate entry information
      if (importer && !source.startsWith("#/")) {
        const importerEntry = moduleToEntry.get(importer);
        if (importerEntry) {
          // Resolve the module to get its ID
          const resolved = await this.resolve(source, importer, { ...options, skipSelf: true });
          if (resolved && !resolved.external) {
            moduleToEntry.set(resolved.id, importerEntry);
          }
        }
        return null; // Let Vite handle normal imports
      }

      // Only process # imports (but not #/csv.wasm which is handled by vite-plugin-wasm-arraybuffer)
      if (!source.startsWith("#/") || source === "#/csv.wasm") {
        return null;
      }

      // Determine target environment from importer path by checking the module chain
      let isNodeFile = false;

      // Check importer's entry by walking up the chain
      if (importer) {
        // Skip _shared.ts and other shared files - they should default to web
        // Also skip .main.ts files as they're imported by both web and node entries
        const isSharedFile = importer.includes("/_shared.ts") ||
                            importer.includes("/worker/helpers/ReusableWorkerPool.ts") ||
                            importer.includes("/worker/helpers/WorkerSession.ts") ||
                            importer.includes(".main.ts");

        if (!isSharedFile) {
          // First check if the importer itself is tracked
          let entry = moduleToEntry.get(importer);

          // If not found, try to infer from filename
          if (!entry && importer.includes(".node.")) {
            isNodeFile = true;
          } else if (entry && entry.includes(".node.")) {
            isNodeFile = true;
          }
        }
      }

      console.log(`[resolve-imports] Resolving ${source} from ${importer}, isNodeFile=${isNodeFile}`);

      // Map # imports to actual source files
      const importMap: Record<string, { node: string; web: string }> = {
        "#/wasm/loaders/loadWASM.js": {
          node: "/src/wasm/loaders/loadWASM.node.ts",
          web: "/src/wasm/loaders/loadWASM.web.ts",
        },
        "#/wasm/loaders/loadWASMSync.js": {
          node: "/src/wasm/loaders/loadWASMSync.node.ts",
          web: "/src/wasm/loaders/loadWASMSync.web.ts",
        },
        "#/worker/helpers/createWorker.js": {
          node: "/src/worker/helpers/createWorker.node.ts",
          web: "/src/worker/helpers/createWorker.web.ts",
        },
        "#/utils/response/getOptionsFromResponse.constants.js": {
          node: "/src/utils/response/getOptionsFromResponse.constants.node.ts",
          web: "/src/utils/response/getOptionsFromResponse.constants.web.ts",
        },
        "#/utils/charset/getCharsetValidation.constants.js": {
          node: "/src/utils/charset/getCharsetValidation.constants.node.ts",
          web: "/src/utils/charset/getCharsetValidation.constants.web.ts",
        },
      };

      const mapping = importMap[source];
      if (!mapping) {
        console.warn(`[resolve-imports] Unknown # import: ${source}`);
        return null;
      }

      // Default to web if not explicitly node
      const targetFile = isNodeFile ? mapping.node : mapping.web;
      const resolved = path.join(process.cwd(), targetFile);

      // Track this resolved module
      if (importer) {
        const importerEntry = moduleToEntry.get(importer);
        if (importerEntry) {
          moduleToEntry.set(resolved, importerEntry);
        }
      }

      console.log(
        `[resolve-imports] Resolved ${source} -> ${targetFile} (from ${importer})`,
      );

      return resolved;
    },

    // Also track regular imports to propagate entry information
    async load(id) {
      // Track all modules loaded during the build
      if (id && !id.startsWith("\0")) {
        // Find which entry this belongs to by checking imports
        // This is handled in resolveId via moduleToEntry tracking
      }
      return null; // Let other plugins/Vite handle loading
    },
  };
}
