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
  // Check if we're building for Node.js (from worker bundle build or other node builds)
  const buildTarget = process.env.TARGET;

  return {
    name: "vite-plugin-resolve-imports",
    enforce: "pre",

    buildStart() {
      // Reset state for each build
      moduleToEntry.clear();
      currentEntry = null;
      if (buildTarget) {
        console.log(`[resolve-imports] Build target from env: ${buildTarget}`);
      }
    },

    async resolveId(source, importer, options) {
      // Track entry points - store the actual source file path
      if (options.isEntry && source) {
        const normalizedSource = source.startsWith("/") ? source : path.join(process.cwd(), source);
        console.log(`[resolve-imports] Entry point: ${normalizedSource}`);
        currentEntry = normalizedSource;
        moduleToEntry.set(normalizedSource, normalizedSource);

        // If no explicit build target, infer from entry filename
        if (!buildTarget && normalizedSource.includes(".node.")) {
          console.log(`[resolve-imports] Inferred Node.js target from entry: ${normalizedSource}`);
        } else if (!buildTarget && !normalizedSource.includes(".node.")) {
          console.log(`[resolve-imports] Inferred Web target from entry: ${normalizedSource}`);
        }

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

      // Determine target environment from importer path
      let isNodeFile = false;

      // Override with build target from environment if available (highest priority)
      // This is crucial for worker bundles where the entry point detection may not work
      if (buildTarget === "node") {
        isNodeFile = true;
      } else if (buildTarget === "web") {
        isNodeFile = false;
      } else if (importer) {
        // For preserveModules builds, infer from importer's filename directly
        // This is more reliable than tracking entry points
        const isSharedFile = importer.includes("/_shared.ts");

        if (!isSharedFile) {
          // Check importer's filename for .node. pattern
          if (importer.includes(".node.")) {
            isNodeFile = true;
          } else if (importer.includes(".web.")) {
            isNodeFile = false;
          } else {
            // For files without explicit .node/.web, check the module chain
            const entry = moduleToEntry.get(importer);
            if (entry && entry.includes(".node.")) {
              isNodeFile = true;
            }
          }
        }
      } else if (currentEntry) {
        // Fallback: infer from current entry filename
        if (currentEntry.includes(".node.")) {
          isNodeFile = true;
        }
      }

      console.log(`[resolve-imports] Resolving ${source} from ${importer}, isNodeFile=${isNodeFile}, buildTarget=${buildTarget}`);

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

    // Post-process output to fix imports in shared modules for preserveModules builds
    generateBundle(options, bundle) {
      // Only for preserveModules builds
      if (!options.preserveModules) return;

      // Identify shared modules that import environment-specific modules
      const sharedModulesNeedingDuplication = new Set<string>();
      const fileImporters = new Map<string, Set<string>>();

      // First pass: build importer graph
      for (const [fileName, chunk] of Object.entries(bundle)) {
        if (chunk.type !== 'chunk') continue;

        for (const importedFile of chunk.imports) {
          if (!fileImporters.has(importedFile)) {
            fileImporters.set(importedFile, new Set());
          }
          fileImporters.get(importedFile)!.add(fileName);
        }

        // Check if this module imports environment-specific modules
        if (chunk.code.match(/\.(node|web)\.js/)) {
          const importers = fileImporters.get(fileName) || new Set();
          const hasNodeImporter = Array.from(importers).some(f => f.includes('.node.'));
          const hasWebImporter = Array.from(importers).some(f => f.includes('.web.'));

          // If imported by both node and web entries, needs duplication
          if (hasNodeImporter && hasWebImporter && !fileName.includes('.node.') && !fileName.includes('.web.')) {
            sharedModulesNeedingDuplication.add(fileName);
          }
        }
      }

      // For now, just fix imports by replacing with correct environment variant
      // based on the importing file
      for (const [fileName, chunk] of Object.entries(bundle)) {
        if (chunk.type !== 'chunk') continue;

        const isNodeFile = fileName.includes('.node.');
        const isWebFile = fileName.includes('.web.') || (!isNodeFile && !fileName.includes('.node.'));

        if (isWebFile && chunk.code.includes('.node.js')) {
          chunk.code = chunk.code.replace(/\.node\.js/g, '.web.js');
          console.log(`[resolve-imports] Fixed ${fileName} to use .web.js imports`);
        } else if (isNodeFile && chunk.code.includes('.web.js')) {
          chunk.code = chunk.code.replace(/\.web\.js/g, '.node.js');
          console.log(`[resolve-imports] Fixed ${fileName} to use .node.js imports`);
        }
      }
    },
  };
}
