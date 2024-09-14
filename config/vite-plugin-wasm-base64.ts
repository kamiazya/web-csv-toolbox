import { readFile } from "fs/promises";

import { dataToEsm } from "@rollup/pluginutils";
import type { Plugin } from "vite";

export default function wasmBase64Plugin(): Plugin {
  return {
    name: "vite-plugin-base64",
    async transform(_source, id) {
      if (!id.endsWith(".wasm")) return;
      const file = await readFile(id);
      const base64 = file.toString("base64");
      const code = `data:application/wasm;base64,${base64}";`;
      return dataToEsm(code);
    },
  };
}
