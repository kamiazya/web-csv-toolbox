import wasm from "vite-plugin-wasm";
import tsconfigPaths from "vite-tsconfig-paths";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [wasm(), tsconfigPaths()],
  test: {
    setupFiles: [".config/vitest.setup.ts"],
    coverage: {
      enabled: false,
      provider: "istanbul", // use istanbul for browser coverage
      include: ["packages/**/*.ts"],
    },
  },
});
