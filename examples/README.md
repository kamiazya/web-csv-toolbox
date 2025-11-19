# Examples

This directory contains example projects demonstrating different usage patterns of web-csv-toolbox.

## Directory Structure

### Node.js Examples
- **node-slim**: Using the slim entry (external WASM loading)
- **node-main**: Using the main version (embedded WASM)
- **node-worker-main**: Using Worker with main version

### Vite Examples
- **vite-bundle-slim**: Browser bundle with slim entry
- **vite-bundle-main**: Browser bundle with main version
- **vite-bundle-worker-slim**: Worker bundle with slim entry
- **vite-bundle-worker-main**: Worker bundle with main version

### Webpack Examples
- **webpack-bundle-worker-slim**: Worker bundle with slim entry using Webpack
- **webpack-bundle-worker-main**: Worker bundle with main version using Webpack

## Running Examples

Before running any example for the first time, set up the workspace at the repository root:

```bash
pnpm install
pnpm run build  # Builds the library used by examples
```

- Requires pnpm (use `corepack enable` on Node 18+)
- Recommended Node.js: 20.6+

### Node.js Examples
```bash
cd examples/node-slim
pnpm install
pnpm start
```

### Browser Examples (Vite)
```bash
cd examples/vite-bundle-main
pnpm install
pnpm run build    # Build for production
pnpm run dev      # Run development server
pnpm run preview  # Preview production build
```

### Browser Examples (Webpack)
```bash
cd examples/webpack-bundle-worker-main
pnpm install
pnpm run build    # Build for production
pnpm run serve    # Run development server
pnpm run preview  # Preview production build
```

## CI/CD Integration

All examples are automatically built and tested in CI/CD pipeline:

### Build Examples Job
- Builds all Vite and Webpack examples
- Verifies build artifacts are created
- Runs in parallel using matrix strategy
- Uploads artifacts for inspection
- **Bundle Analysis**: Automatically uploads bundle stats to Codecov

### Test Node Examples Job
- Tests all Node.js examples
- Runs examples with timeout protection
- Ensures examples execute successfully

### Verify Catalog Job
- Verifies pnpm version catalog consistency
- Checks that all packages use catalog versions
- Ensures version alignment across monorepo

## Bundle Size Monitoring

Each example is configured with Codecov bundle analysis to detect size regressions:

### Codecov Integration
- **Vite examples**: Use `@codecov/vite-plugin`
- **Webpack examples**: Use `@codecov/webpack-plugin`
- **Bundle names**:
  - `example-vite-bundle-slim`
  - `example-vite-bundle-main`
  - `example-vite-bundle-worker-slim`
  - `example-vite-bundle-worker-main`
  - `example-webpack-bundle-worker-slim`
  - `example-webpack-bundle-worker-main`

### Monitoring Benefits
- Automatic detection of bundle size increases
- Historical trend tracking
- PR comments showing size impact
- Separate tracking for each example variant

## Version Management

All examples use pnpm version catalog for dependency management. Versions are centrally managed in `pnpm-workspace.yaml`:

```yaml
catalogs:
  default:
    vite: ^7.2.2
    typescript: ^5.9.3
    webpack: ^5.97.1
    # ... more dependencies
```

To update a dependency version, modify `pnpm-workspace.yaml` and run `pnpm install`.

## Bundle Size Comparison

Actual bundle sizes vary by bundler, configuration, and features used. As a rule of thumb:
- The main entry embeds the WASM, resulting in a larger main bundle.
- The slim entry loads WASM externally, resulting in a smaller main bundle and a separate WASM asset.
