import wasm from "vite-plugin-wasm";
import tsconfigPaths from "vite-tsconfig-paths";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [wasm(), tsconfigPaths() as any],
  test: {
    setupFiles: [".config/vitest.setup.ts"],
    coverage: {
      enabled: true,
      provider: "istanbul", // use istanbul for browser coverage
      include: ["packages/**/*.ts"],
    },
  },
});
