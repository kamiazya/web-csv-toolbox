import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    setupFiles: ["config/vitest.setup.ts"],
    exclude: ["node_modules", "lib", "**/*.deno.*.ts"],
    browser: {
      name: "chrome",
    },
  },
});
