import codspeedPlugin from "@codspeed/vitest-plugin";
import { defaultExclude, defineWorkspace } from "vitest/config";

export default defineWorkspace([
  {
    extends: "./vite.config.ts",
    test: {
      name: "typecheck",
      typecheck: {
        enabled: true,
        only: true,
      },
    },
  },
  {
    extends: "./vite.config.ts",
    test: {
      name: "node",
      environment: "node",
      exclude: [...defaultExclude, "**/*.browser.{spec,test}.ts"],
    },
    plugins: [codspeedPlugin() as any],
  },
  {
    extends: "./vite.config.ts",
    test: {
      name: "browser",
      include: ["**/*.{test,spec}.ts", "**/*.browser.{spec,test}.ts"],
      exclude: [...defaultExclude, "**/*.node.{spec,test}.ts"],
      browser: {
        enabled: true,
        name: "chrome",
        provider: "webdriverio",
        headless: true,
      },
    },
  },
]);
