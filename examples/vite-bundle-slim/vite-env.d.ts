/// <reference types="vite/client" />

// Support for importing WASM files with ?url suffix
declare module '*.wasm?url' {
  const url: string;
  export default url;
}
