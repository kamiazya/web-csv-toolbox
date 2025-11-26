import type { Plugin } from "vite";
import path from "node:path";

/**
 * Module target environment
 */
type TargetEnvironment = "node" | "web" | "shared";

/**
 * Entry variant (main vs slim)
 */
type EntryVariant = "main" | "slim";

/**
 * Module metadata tracked during resolution
 */
interface ModuleMetadata {
  /** The entry point that caused this module to be loaded */
  entryId: string;
  /** Target environment for this module */
  target: TargetEnvironment;
  /** Entry variant (main vs slim) */
  variant: EntryVariant;
}

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
 * 4. Fixes cross-environment imports in shared modules during bundle generation
 */
export function resolveImportsPlugin(): Plugin {
  // Track metadata for each module using resolved IDs
  const moduleMetadata = new Map<string, ModuleMetadata>();

  // Track current entry being processed
  let currentEntry: string | null = null;

  // Check if we're building for a specific target (from environment)
  const buildTarget = process.env.TARGET as TargetEnvironment | undefined;

  /**
   * Determine target environment from a resolved module ID
   */
  function getTargetFromId(id: string): TargetEnvironment {
    if (id.includes(".node.")) return "node";
    if (id.includes(".web.")) return "web";
    if (id.includes("/common.ts")) return "shared";
    return "shared"; // Default for files without explicit target
  }

  /**
   * Determine entry variant (main vs slim) from a resolved module ID
   */
  function getVariantFromId(id: string): EntryVariant {
    if (id.includes("/slim.") || id.includes("slim.")) return "slim";
    return "main"; // Default to main
  }

  /**
   * Normalize a module ID to ensure consistency
   */
  function normalizeId(id: string): string {
    // Remove query strings and hash
    const normalized = id.split("?")[0]?.split("#")[0] ?? id;
    // Ensure absolute path
    return normalized.startsWith("/") || normalized.startsWith(process.cwd())
      ? path.normalize(normalized)
      : path.join(process.cwd(), normalized);
  }

  return {
    name: "vite-plugin-resolve-imports",
    enforce: "pre",

    buildStart() {
      // Reset state for each build
      moduleMetadata.clear();
      currentEntry = null;
      if (buildTarget) {
        console.log(`[resolve-imports] Build target from env: ${buildTarget}`);
      }
    },

    async resolveId(source, importer, options) {
      // Track entry points using resolved IDs
      if (options.isEntry && source) {
        // Resolve the entry to get consistent ID
        const resolved = await this.resolve(source, undefined, {
          ...options,
          skipSelf: true,
        });

        if (!resolved || resolved.external) {
          return null;
        }

        const entryId = normalizeId(resolved.id);
        currentEntry = entryId;

        // Determine target for this entry
        const target: TargetEnvironment = buildTarget || getTargetFromId(entryId);

        // Determine variant for this entry
        const variant: EntryVariant = getVariantFromId(entryId);

        moduleMetadata.set(entryId, {
          entryId,
          target,
          variant,
        });

        console.log(
          `[resolve-imports] Entry point: ${path.relative(process.cwd(), entryId)} (target: ${target}, variant: ${variant})`
        );

        return null; // Let Vite handle the actual resolution
      }

      // Track all module resolutions to propagate entry information
      if (importer && !source.startsWith("#/")) {
        // Normalize importer ID before lookup
        const normalizedImporter = normalizeId(importer);
        const importerMeta = moduleMetadata.get(normalizedImporter);

        if (importerMeta) {
          // Resolve the module to get its ID
          const resolved = await this.resolve(source, importer, {
            ...options,
            skipSelf: true,
          });

          if (resolved && !resolved.external) {
            const resolvedId = normalizeId(resolved.id);

            // Determine target: explicit if file has .node/.web, otherwise keep as shared
            const moduleTarget = getTargetFromId(resolvedId);
            const target: TargetEnvironment =
              moduleTarget !== "shared" ? moduleTarget : "shared";

            moduleMetadata.set(resolvedId, {
              entryId: importerMeta.entryId,
              target,
              variant: importerMeta.variant, // Propagate variant from importer
            });
          }
        }
        return null; // Let Vite handle normal imports
      }

      // Only process # imports (but not #/csv.wasm which is handled by vite-plugin-wasm-arraybuffer)
      if (!source.startsWith("#/") || source === "#/csv.wasm") {
        return null;
      }

      // Determine target environment for this import
      let targetEnv: TargetEnvironment = "web"; // Default to web

      if (buildTarget) {
        // Use explicit build target if available
        targetEnv = buildTarget;
      } else if (importer) {
        // Normalize importer and check metadata
        const normalizedImporter = normalizeId(importer);
        const importerMeta = moduleMetadata.get(normalizedImporter);

        if (importerMeta) {
          // If importer is a shared file, default to web for # imports
          // (shared files go to dist/, not dist/node/)
          targetEnv = importerMeta.target === "shared" ? "web" : importerMeta.target;
        } else {
          // Fallback: infer from importer filename
          targetEnv = getTargetFromId(normalizedImporter);
        }
      } else if (currentEntry) {
        // Fallback: use current entry's target
        const entryMeta = moduleMetadata.get(currentEntry);
        if (entryMeta) {
          targetEnv = entryMeta.target === "shared" ? "web" : entryMeta.target;
        }
      }

      console.log(
        `[resolve-imports] Resolving ${source} from ${importer ? path.relative(process.cwd(), importer) : "unknown"}, target=${targetEnv}`
      );

      // Determine variant from metadata
      let entryVariant: EntryVariant = "main"; // Default to main
      if (importer) {
        const normalizedImporter = normalizeId(importer);
        const importerMeta = moduleMetadata.get(normalizedImporter);
        if (importerMeta) {
          entryVariant = importerMeta.variant;
        }
      } else if (currentEntry) {
        const entryMeta = moduleMetadata.get(currentEntry);
        if (entryMeta) {
          entryVariant = entryMeta.variant;
        }
      }

      // Map # imports to actual source files
      // Some imports have slim-specific versions that don't bundle base64 WASM
      const importMap: Record<string, { node: string; web: string; slim?: string }> = {
        "#/wasm/loaders/loadWASM.js": {
          node: "/src/wasm/loaders/loadWASM.node.ts",
          web: "/src/wasm/loaders/loadWASM.web.ts",
        },
        "#/wasm/loaders/loadWASMSync.js": {
          node: "/src/wasm/loaders/loadWASMSync.node.ts",
          web: "/src/wasm/loaders/loadWASMSync.web.ts",
          slim: "/src/wasm/loaders/loadWASMSync.slim.ts", // Slim version without base64
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

      // Select target file based on environment and variant
      // For slim entry, use slim-specific version if available
      let targetFile: string;
      if (entryVariant === "slim" && mapping.slim) {
        targetFile = mapping.slim;
        console.log(
          `[resolve-imports] Using slim version for ${source} (variant: ${entryVariant})`
        );
      } else {
        targetFile = targetEnv === "node" ? mapping.node : mapping.web;
      }
      const resolvedPath = path.join(process.cwd(), targetFile);

      // Resolve this module through Vite to get normalized ID
      const resolved = await this.resolve(targetFile, importer, {
        ...options,
        skipSelf: true,
      });

      if (!resolved || resolved.external) {
        console.warn(`[resolve-imports] Failed to resolve ${targetFile}`);
        return null;
      }

      const resolvedId = normalizeId(resolved.id);

      // Track metadata for this resolved module
      if (importer) {
        const normalizedImporter = normalizeId(importer);
        const importerMeta = moduleMetadata.get(normalizedImporter);

        if (importerMeta) {
          moduleMetadata.set(resolvedId, {
            entryId: importerMeta.entryId,
            target: getTargetFromId(resolvedId),
            variant: importerMeta.variant, // Propagate variant
          });
        }
      }

      console.log(
        `[resolve-imports] Resolved ${source} -> ${path.relative(process.cwd(), resolvedId)}`
      );

      return resolved.id;
    },

    // Post-process output to fix imports in shared modules for preserveModules builds
    generateBundle(options, bundle) {
      // Only for preserveModules builds
      if (!options.preserveModules) return;

      // Build a map of available files in the bundle with their full paths
      const bundleFiles = new Map<string, Set<string>>();

      for (const fileName of Object.keys(bundle)) {
        // Extract base name without .node/.web suffix and use only the basename
        const baseName = path.basename(
          fileName
            .replace(/\.node\.js$/, ".js")
            .replace(/\.web\.js$/, ".js")
        );

        if (!bundleFiles.has(baseName)) {
          bundleFiles.set(baseName, new Set());
        }
        // Store full path (including node/ directory if present)
        bundleFiles.get(baseName)!.add(fileName);
      }

      // Debug: Log bundleFiles map
      if (bundleFiles.size > 0) {
        console.log(`[resolve-imports] Bundle files map (${bundleFiles.size} entries):`);
        for (const [key, variants] of bundleFiles.entries()) {
          if (variants.size > 1) {
            console.log(`  ${key}: [${Array.from(variants).join(", ")}]`);
          }
        }
      }

      // Process each chunk
      for (const [fileName, chunk] of Object.entries(bundle)) {
        if (chunk.type !== "chunk") continue;

        // Determine this file's target
        const fileTarget = fileName.includes(".node.")
          ? "node"
          : fileName.includes(".web.")
          ? "web"
          : "shared";

        // Process each import in this chunk
        for (const importPath of chunk.imports) {
          // Skip external imports
          if (!importPath.endsWith(".js")) continue;

          // Check if this import has .node or .web variant
          const hasNodeVariant = importPath.includes(".node.js");
          const hasWebVariant = importPath.includes(".web.js");

          // If import is already environment-specific, validate it matches file target
          if (hasNodeVariant || hasWebVariant) {
            const importTarget = hasNodeVariant ? "node" : "web";

            // Check if we need to rewrite this import
            if (fileTarget !== "shared" && fileTarget !== importTarget) {
              // Get base import path
              const baseImport = importPath
                .replace(/\.node\.js$/, ".js")
                .replace(/\.web\.js$/, ".js");

              // Construct expected import path for this file's target
              const expectedImport = baseImport.replace(
                /\.js$/,
                `.${fileTarget}.js`
              );

              // Check if the expected variant exists in the bundle
              const baseName = path.basename(baseImport);
              const variants = bundleFiles.get(baseName);

              console.log(`[resolve-imports] Checking import in ${fileName} (target: ${fileTarget}):`);
              console.log(`  Import: ${importPath} (target: ${importTarget})`);
              console.log(`  Base: ${baseName}, Expected: ${path.basename(expectedImport)}`);
              console.log(`  Variants: ${variants ? Array.from(variants).join(", ") : "none"}`);

              if (variants) {
                // Find the actual file path with correct target
                const expectedBasename = path.basename(expectedImport);
                const actualFile = Array.from(variants).find(v => path.basename(v) === expectedBasename);

                if (actualFile) {
                  // Calculate relative path from current file to target file
                  const currentDir = path.dirname(fileName);
                  const targetPath = actualFile;
                  const relativePath = path.relative(currentDir, targetPath);

                  // Normalize to forward slashes and add ./ prefix
                  const normalizedPath = relativePath.replace(/\\/g, '/');
                  const finalPath = normalizedPath.startsWith('.') ? normalizedPath : `./${normalizedPath}`;

                  // Rewrite the import in the chunk code
                  // Match with optional ./ prefix
                  const importPattern = new RegExp(
                    `(['"\`])\\.\\/?(${importPath.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})\\1`,
                    "g"
                  );

                  const newCode = chunk.code.replace(
                    importPattern,
                    `$1${finalPath}$1`
                  );

                  if (newCode !== chunk.code) {
                    chunk.code = newCode;
                    console.log(
                      `[resolve-imports] Rewrote import in ${fileName}: ${importPath} -> ${finalPath}`
                    );
                  } else {
                    console.log(`[resolve-imports] No changes made (pattern not found in code)`);
                  }
                } else {
                  console.log(`[resolve-imports] Expected variant not found, skipping`);
                }
              }
            }
          } else if (fileTarget !== "shared") {
            // Import has no .node/.web suffix, but file has a target
            // Check if environment-specific variant exists
            const baseImport = importPath;
            const targetImport = importPath.replace(/\.js$/, `.${fileTarget}.js`);

            const baseName = path.basename(baseImport);
            const variants = bundleFiles.get(baseName);

            // Only rewrite if the target variant exists
            if (variants) {
              const targetBasename = path.basename(targetImport);
              const actualFile = Array.from(variants).find(v => path.basename(v) === targetBasename);

              if (actualFile) {
                // Calculate relative path from current file to target file
                const currentDir = path.dirname(fileName);
                const targetPath = actualFile;
                const relativePath = path.relative(currentDir, targetPath);

                // Normalize to forward slashes and add ./ prefix
                const normalizedPath = relativePath.replace(/\\/g, '/');
                const finalPath = normalizedPath.startsWith('.') ? normalizedPath : `./${normalizedPath}`;

                // Match with optional ./ prefix
                const importPattern = new RegExp(
                  `(['"\`])\\.\\/?(${importPath.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})\\1`,
                  "g"
                );

                const newCode = chunk.code.replace(
                  importPattern,
                  `$1${finalPath}$1`
                );

                if (newCode !== chunk.code) {
                  chunk.code = newCode;
                  console.log(
                    `[resolve-imports] Added target suffix in ${fileName}: ${importPath} -> ${finalPath}`
                  );
                }
              }
            }
          }
        }
      }
    },
  };
}
