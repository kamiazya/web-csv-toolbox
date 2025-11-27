# Examples

This directory contains example projects demonstrating different usage patterns of web-csv-toolbox.

## Directory Structure

### Node.js Examples
- **node-slim**: Using the slim entry (external WASM loading)
- **node-main**: Using the main version (embedded WASM)
- **node-worker-main**: Using Worker with main version

### API Examples
- **[hono-secure-api](./hono-secure-api)**: Production-ready secure CSV validation API with Hono
  - Demonstrates all security layers (early rejection, input validation, resource limits, timeout protection)
  - Includes comprehensive Vitest security tests
  - Server-Sent Events (SSE) for real-time validation feedback
  - Zod schema validation
  - [View on GitHub](https://github.com/kamiazya/web-csv-toolbox/tree/main/examples/hono-secure-api) | [Documentation](https://kamiazya.github.io/web-csv-toolbox/how-to-guides/secure-csv-processing.html)

### Engine Test Examples
- **[browser-engine-test](./browser-engine-test)**: Interactive test suite for comparing parsing engines
  - Tests JavaScript, WASM, Worker, and GPU engines
  - Playwright-based automated testing
  - **Headless WebGPU support** with Chrome flags
  - Performance benchmarks
  - See [browser-engine-test/README.md](./browser-engine-test/README.md) for headless GPU configuration

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
- **Required Node.js: 24.0+** (uses `using` syntax for explicit resource management)

### Node.js Examples
```bash
cd examples/node-slim
pnpm install
pnpm start
```

### API Examples
```bash
cd examples/hono-secure-api
pnpm install
pnpm dev          # Run development server (http://localhost:3000)
pnpm test         # Run security tests
pnpm test:coverage # Run tests with coverage
```

**API Endpoints:**
- `GET /health` - Health check
- `POST /validate-csv` - CSV validation with SSE streaming

See the [README](./hono-secure-api/README.md) for detailed usage and examples.

### Engine Test Examples
```bash
cd examples/browser-engine-test
pnpm install
pnpm dev          # Interactive browser testing (http://localhost:5173)
pnpm test         # Automated Playwright tests
pnpm test:gpu     # GPU-specific tests with WebGPU flags
pnpm test:headed  # Tests with visible browser
```

**Headless WebGPU Testing:**

For GPU tests in CI/CD environments, the example includes Chrome flags for headless WebGPU:
```bash
--headless=new --use-angle=vulkan --enable-features=Vulkan --disable-vulkan-surface --enable-unsafe-webgpu
```

See [Chrome WebGPU Testing Guide](https://developer.chrome.com/blog/supercharge-web-ai-testing) for details.

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
