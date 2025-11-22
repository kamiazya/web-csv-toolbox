#!/usr/bin/env -S deno run --allow-read --allow-write
/**
 * Setup script to prepare workspace dist for Deno example
 *
 * This script copies the built dist from the workspace to Deno's npm cache,
 * allowing the example to use the local build instead of downloading from npm.
 */

import { dirname, join } from "jsr:@std/path@^1.0.0";

// Get the script's directory and repository root
const scriptDir = dirname(new URL(import.meta.url).pathname);
const repoRoot = join(scriptDir, "../../..");

// Read version from package.json
const packageJson = JSON.parse(
  await Deno.readTextFile(join(repoRoot, "package.json"))
);
const version = packageJson.version;

console.log(`Setting up Deno cache for web-csv-toolbox@${version}...`);

// Create the npm cache directory structures that Deno may use
// Deno can use either .deno_cache/npm/ or node_modules/.deno/ depending on configuration
const npmCacheDirs = [
  join(scriptDir, ".deno_cache/npm/registry.npmjs.org/web-csv-toolbox", version),
  join(scriptDir, `node_modules/.deno/web-csv-toolbox@${version}/node_modules/web-csv-toolbox`),
];

for (const dir of npmCacheDirs) {
  await Deno.mkdir(dir, { recursive: true });
}

// Copy built dist and package.json to all Deno npm cache locations
const distDir = join(repoRoot, "dist");

for (const npmCacheDir of npmCacheDirs) {
  const targetDistDir = join(npmCacheDir, "dist");

  // Remove existing dist if it exists
  try {
    await Deno.remove(targetDistDir, { recursive: true });
  } catch {
    // Ignore if doesn't exist
  }

  // Copy dist directory
  await Deno.mkdir(targetDistDir, { recursive: true });
  for await (const entry of Deno.readDir(distDir)) {
    const srcPath = join(distDir, entry.name);
    const destPath = join(targetDistDir, entry.name);

    if (entry.isDirectory) {
      await copyDir(srcPath, destPath);
    } else {
      await Deno.copyFile(srcPath, destPath);
    }
  }

  // Copy package.json
  await Deno.copyFile(
    join(repoRoot, "package.json"),
    join(npmCacheDir, "package.json")
  );

  // Copy optional files
  try {
    await Deno.copyFile(
      join(repoRoot, "README.md"),
      join(npmCacheDir, "README.md")
    );
  } catch {
    // Ignore if doesn't exist
  }

  try {
    await Deno.copyFile(
      join(repoRoot, "LICENSE"),
      join(npmCacheDir, "LICENSE")
    );
  } catch {
    // Ignore if doesn't exist
  }

  console.log(`✓ Populated: ${npmCacheDir}`);
}

console.log("✓ Deno cache populated with workspace build");

// Also copy web-csv-toolbox-wasm dependency
const wasmPackageJson = JSON.parse(
  await Deno.readTextFile(join(repoRoot, "web-csv-toolbox-wasm/pkg/package.json"))
);
const wasmVersion = wasmPackageJson.version;

console.log(`\nSetting up Deno cache for web-csv-toolbox-wasm@${wasmVersion}...`);

const wasmNpmCacheDirs = [
  join(scriptDir, ".deno_cache/npm/registry.npmjs.org/web-csv-toolbox-wasm", wasmVersion),
  join(scriptDir, `node_modules/.deno/web-csv-toolbox-wasm@${wasmVersion}/node_modules/web-csv-toolbox-wasm`),
];

for (const dir of wasmNpmCacheDirs) {
  await Deno.mkdir(dir, { recursive: true });
}

const wasmPkgDir = join(repoRoot, "web-csv-toolbox-wasm/pkg");

for (const wasmCacheDir of wasmNpmCacheDirs) {
  // Copy all files from pkg directory
  for await (const entry of Deno.readDir(wasmPkgDir)) {
    const srcPath = join(wasmPkgDir, entry.name);
    const destPath = join(wasmCacheDir, entry.name);

    if (entry.isDirectory) {
      await copyDir(srcPath, destPath);
    } else {
      await Deno.copyFile(srcPath, destPath);
    }
  }

  console.log(`✓ Populated: ${wasmCacheDir}`);
}

console.log("✓ Deno cache populated with web-csv-toolbox-wasm");

// Helper function to recursively copy directories
async function copyDir(src: string, dest: string) {
  await Deno.mkdir(dest, { recursive: true });

  for await (const entry of Deno.readDir(src)) {
    const srcPath = join(src, entry.name);
    const destPath = join(dest, entry.name);

    if (entry.isDirectory) {
      await copyDir(srcPath, destPath);
    } else {
      await Deno.copyFile(srcPath, destPath);
    }
  }
}
