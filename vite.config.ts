import wasm from "vite-plugin-wasm";
import tsconfigPaths from 'vite-tsconfig-paths';
import { defineConfig } from "vitest/config";
import wasmBase64Plugin from './config/vite-plugin-wasm-base64';

export default defineConfig({
  plugins: [
    wasmBase64Plugin,
    wasm(),
    tsconfigPaths() as any,
  ],
  test: {
    setupFiles: ["config/vitest.setup.ts"],
    browser: {
      name: "chrome",
    },
    coverage: {
      provider: "istanbul", // use istanbul for browser coverage
      include: ["packages/**/*.ts"],
    },
  },
});
