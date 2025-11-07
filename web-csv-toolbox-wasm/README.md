# web-csv-toolbox-wasm

WebAssembly implementation for web-csv-toolbox.

## Prerequisites

- Rust (installed via [rustup](https://rustup.rs/))
- wasm-pack
- wasm32-unknown-unknown target

## Setup

### Install Rust (if not already installed)

```bash
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
```

### Add WebAssembly target

```bash
rustup target add wasm32-unknown-unknown
```

### Install wasm-pack

```bash
cargo install wasm-pack
```

## Development

### Build

```bash
# From project root
pnpm build:wasm

# Or directly with wasm-pack
wasm-pack build --target web
```

### Format code

```bash
# From project root
pnpm format:rust

# Or directly with cargo
cargo fmt
```

### Run Clippy (linter)

```bash
cargo clippy --all-targets --all-features
```

### Check compilation

```bash
cargo check --target wasm32-unknown-unknown
```

### Run tests

```bash
# From project root
pnpm test:rust

# Or directly with cargo
cargo test

# Run tests with output
cargo test -- --nocapture
```

## Project Structure

- `src/lib.rs` - Main WebAssembly module implementation
- `Cargo.toml` - Rust dependencies and project configuration
- `rustfmt.toml` - Code formatting rules
- `clippy.toml` - Linter configuration
- `pkg/` - Generated WebAssembly output (after build)

## VS Code Setup

The project includes VS Code settings for Rust development:

- rust-analyzer configured for wasm32 target
- Auto-formatting on save
- Clippy integration for real-time linting

Make sure to install the [rust-analyzer](https://marketplace.visualstudio.com/items?itemName=rust-lang.rust-analyzer) extension.

## Configuration

### rustfmt.toml

Configures code formatting style:
- Edition: 2021
- Max width: 100 characters
- Small heuristics: Default

### clippy.toml

Configures linting behavior:
- Avoid breaking exported API changes

## Troubleshooting

### cargo command not found

Make sure to source the Cargo environment:

```bash
source "$HOME/.cargo/env"
```

Or add it to your shell rc file (~/.zshrc, ~/.bashrc):

```bash
echo '. "$HOME/.cargo/env"' >> ~/.zshrc
```

### wasm32 target not found

Install the WebAssembly target:

```bash
rustup target add wasm32-unknown-unknown
```

### rust-analyzer errors in VS Code

If you see ABI mismatch errors from rust-analyzer:

1. Restart rust-analyzer server in VS Code:
   - Open Command Palette (Cmd+Shift+P / Ctrl+Shift+P)
   - Run: "rust-analyzer: Restart server"

2. Clear rust-analyzer cache:
   ```bash
   rm -rf ~/.cache/rust-analyzer
   rm -rf ~/Library/Caches/rust-analyzer
   ```

3. Clean and rebuild:
   ```bash
   cargo clean
   cargo build
   ```
