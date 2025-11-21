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

// Create the npm cache directory structure that Deno expects
const npmCacheDir = join(
  scriptDir,
  ".deno_cache/npm/registry.npmjs.org/web-csv-toolbox",
  version
);

await Deno.mkdir(npmCacheDir, { recursive: true });

// Copy built dist and package.json to Deno's npm cache
const distDir = join(repoRoot, "dist");
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

console.log("✓ Deno cache populated with workspace build");
console.log("  Remember to set DENO_DIR=.deno_cache when running deno commands");

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
