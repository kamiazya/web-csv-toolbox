export default  {
  "*.{js,ts,json}": "biome check --no-errors-on-unmatched --apply",
  "*.rs": [
    () => "cargo fmt --manifest-path=./web-csv-toolbox-wasm/Cargo.toml --all",
    () => "cargo clippy --manifest-path=./web-csv-toolbox-wasm/Cargo.toml --all-targets --all-features",
  ],
};
