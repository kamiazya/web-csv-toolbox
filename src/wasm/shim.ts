import init, { WASM } from "./Cargo.toml";

let wasm: WASM = new Proxy({} as WASM, {
  get() {
    throw new Error("WASM not initialized.");
  },
});

export async function loadWASM() {
  wasm = await init();
}

export function parseStringWASM(csv: string): string[][] {
  return wasm.parseString(csv);
}
