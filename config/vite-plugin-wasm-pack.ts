// Copy from https://github.com/nshen/vite-plugin-wasm-pack/blob/a6d261f55a0ef53eb4c277251c5d7391ee657bae/src/index.ts
// and edit for some improvements.
import { dataToEsm } from "@rollup/pluginutils";
import { createReadStream, readFileSync } from "fs";
import fs from "node:fs/promises";
import path from "path";
import { PluginOption } from "vite";

async function exists(filepath: string) {
  try {
    return !!(await fs.lstat(filepath));
  } catch (e) {
    return false;
  }
}

interface Options {
  /**
   * local crates paths, if you only use crates from npm, leave an empty array here.
   */
  crates: string[];
  /**
   * Emit wasm file to dist folder
   * @default true
   */
  copyWasm?: boolean;
}

function vitePluginWasmPack({
  crates,
  copyWasm = true,
}: Options): PluginOption {
  const prefix = "\0";
  const pkg = "pkg"; // default folder of wasm-pack module
  let baseDir: string;
  let isBuild = false;

  type CrateType = { path: string };
  // wasmfileName : CrateType
  // 'my_crate_bg.wasm': {path:'../../my_crate/pkg/my_crate_bg.wasm'}
  const wasmMap = new Map<string, CrateType>();
  for (const cratePath of crates) {
    // from ../../my-crate  ->  my_crate_bg.wasm
    const wasmFile = path.basename(cratePath).replace(/\-/g, "_") + "_bg.wasm";
    wasmMap.set(wasmFile, {
      path: path.join(cratePath, pkg, wasmFile),
    });
  }

  return {
    name: "vite-plugin-wasm-pack",
    enforce: "pre",
    configResolved(resolvedConfig) {
      baseDir = resolvedConfig.base;
      isBuild = resolvedConfig.command === 'build';
    },


    resolveId(id: string) {
      // ?arraybuffer handling delegated to vite-plugin-wasm-arraybuffer
      // Skip if this is an arraybuffer import
      if (id.includes("?arraybuffer")) {
        console.log(`[vite-plugin-wasm-pack] resolveId: skipping arraybuffer import: ${id}`);
        return null;
      }

      for (const cratePath of crates) {
        const crateName = path.basename(cratePath);
        // Only match if id is exactly crateName or starts with crateName followed by '/'
        // This prevents false matches like 'vitest/...' matching 'web-csv-toolbox-wasm'
        if (id === crateName || id.startsWith(crateName + '/')) {
          return prefix + id;
        }
        // Also handle .wasm file imports directly (with or without ?url query)
        const cleanId = id.replace(/\?.*$/, ''); // Remove query parameters
        if (cleanId.includes(crateName) && cleanId.endsWith('.wasm')) {
          return prefix + id;
        }
      }
      return null;
    },
    async load(id: string) {

      if (id.indexOf(prefix) === 0) {
        id = id.replace(prefix, "");

        // Only handle modules that we resolved in resolveId
        // Check if this is one of our crates
        let isOurCrate = false;
        for (const cratePath of crates) {
          const crateName = path.basename(cratePath);
          if (id === crateName || id.startsWith(crateName + '/')) {
            isOurCrate = true;
            break;
          }
        }

        if (!isOurCrate) {
          // Not our module, let other plugins handle it
          return null;
        }

        // Skip .wasm imports with ?arraybuffer - let the arraybuffer plugin handle them
        if (id.includes("?arraybuffer")) {
          return null;
        }

        // Handle .wasm file imports (with or without ?url query)
        const cleanId = id.replace(/\?.*$/, ''); // Remove query parameters
        if (cleanId.endsWith(".wasm")) {
          const wasmPath = path.join("./node_modules", cleanId);
          try {
            const file = await fs.readFile(wasmPath);
            const base64 = file.toString("base64");
            // Return as data URL for compatibility with both browser and Node.js
            // This works with both direct imports and ?url imports
            return dataToEsm(`data:application/wasm;base64,${base64}`);
          } catch (error) {
            console.error(`[vite-plugin-wasm-pack] Failed to load WASM file: ${wasmPath}`, error);
            return null;
          }
        }
        const modulejs = path.join(
          "./node_modules",
          id,
          id.replace(/\-/g, "_") + ".js",
        );
        try {
          let code = await fs.readFile(modulejs, {
            encoding: "utf-8",
          });

          // Check for new wasm-bindgen format (direct import with __wbg_set_wasm)
          // New format: import * as wasm from "./xxx_bg.wasm"; ... __wbg_set_wasm(wasm);
          if (code.includes('__wbg_set_wasm')) {
            // New format detected - no patch needed for default URL loading
            // The new format doesn't have a default URL fallback to patch
            return code;
          }

          // Legacy format: patch default WASM loading with an error
          // This library always provides WASM explicitly via ?arraybuffer imports
          // If this code path is reached, it indicates incorrect usage
          const originalCode = code;
          code = code.replace(
            /if \(typeof module_or_path === ['"]undefined['"]\) \{\s+module_or_path = new URL\(['"]\w+\.wasm['"],\s*import\.meta\.url\);?\s+\}/g,
            `if (typeof module_or_path === 'undefined') {
        throw new Error('WASM module must be explicitly provided. Please report this as a bug if you see this error.');
    }`
          );

          // Verify the patch was applied successfully for legacy format
          if (code === originalCode) {
            throw new Error(
              `Failed to apply WASM patch to ${modulejs}. ` +
              `The wasm-bindgen code structure may have changed. ` +
              `Please update the patch in vite-plugin-wasm-pack.ts`
            );
          }

          return code;
        } catch (error) {
          console.error(`[vite-plugin-wasm-pack] Failed to load: ${modulejs}`, error);
          return null;
        }
      }
      // Return null for other modules to let Vite handle them
      return null;
    },

    async buildStart(_inputOptions) {
      for await (const cratePath of crates) {
        const pkgPath = path.join(cratePath, pkg);
        const crateName = path.basename(cratePath);

        // build pkg if not exists
        if ((await exists(pkgPath)) === false) {
          console.error(
            `Error: Can't find ${pkgPath}, run wasm-pack build ${cratePath} --target web first`,
          );
        }
        // copy pkg generated by wasm-pack to node_modules
        try {
          await fs.cp(pkgPath, path.join("node_modules", crateName), {
            recursive: true,
          });
        } catch (error) {
          this.error(`copy crates failed: ${error}`);
        }
        // replace default load path with '/assets/xxx.wasm'
        const jsName = crateName.replace(/\-/g, "_") + ".js";

        /**
         * if use node module and name is '@group/test'
         * cratePath === '@group/test'
         * crateName === 'test'
         */

        let jsPath = path.join("./node_modules", crateName, jsName);
        const regex = /input = new URL\('(.+)'.+;/g;
        let code = await fs.readFile(path.resolve(jsPath), {
          encoding: "utf-8",
        });
        code = code.replace(regex, (_match, group) => {
          return `input = "${path.posix.join(baseDir, group)}"`;
        });
        await fs.writeFile(jsPath, code);
      }
    },

    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (req.url && /\.wasm?$/.test(req.url)) {
          const basename = path.basename(req.url);
          const entry = wasmMap.get(basename);
          if (entry) {
            res
              .setHeader("Content-Type", "application/wasm")
              .setHeader(
                "Cache-Control",
                "no-cache, no-store, must-revalidate",
              );
            createReadStream(entry!.path).pipe(res);
            return;
          }
        }
        next();
      });
    },

    buildEnd() {
      if (copyWasm && isBuild) {
        for (const [fileName, crate] of wasmMap.entries()) {
          // Use user-friendly name instead of internal implementation name
          // web_csv_toolbox_wasm_bg.wasm -> csv.wasm
          const outputFileName = fileName === "web_csv_toolbox_wasm_bg.wasm"
            ? "csv.wasm"
            : fileName;

          this.emitFile({
            type: "asset",
            fileName: outputFileName,
            source: readFileSync(crate.path),
          });
        }
      }
    },
  };
}

export default vitePluginWasmPack;
