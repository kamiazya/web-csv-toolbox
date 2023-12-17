import { defineConfig } from "rollup";
import del from "rollup-plugin-delete";
import dts from "rollup-plugin-dts";
import typescript from "rollup-plugin-typescript2";

export default defineConfig({
  input: "src/index.ts",
  output: {
    dir: "lib",
    format: "esm",
  },
  plugins: [
    typescript({
      clean: true,
    }),
    del({
      targets: ["lib/**/*", "!lib/**/index.*"],
      hook: "buildEnd",
    }),
    dts(),
  ],
});
