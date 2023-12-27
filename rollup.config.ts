import { defineConfig } from "rollup";
import del from "rollup-plugin-delete";
import dts from "rollup-plugin-dts";
import ts from "rollup-plugin-typescript2";

export default defineConfig([
  {
    input: "src/index.ts",
    plugins: [
      ts({
        tsconfig: "tsconfig.build.json",
      }),
    ],
    output: {
      file: "lib/index.js",
    },
  },
  {
    input: "lib/index.d.ts",
    plugins: [
      dts(),
      del({
        targets: ["lib/**/*", "!lib/index.(d.ts|js)"],
        hook: "buildEnd",
      }),
    ],
    output: {
      file: "lib/index.d.ts",
      format: "esm",
    },
  },
  {
    input: "src/index.ts",
    plugins: [
      ts({
        tsconfig: "tsconfig.build.json",
        tsconfigOverride: {
          compilerOptions: {
            removeComments: true,
            declaration: false,
          },
        },
      }),
    ],
    output: {
      file: "lib/index.js",
    },
  },
]);
