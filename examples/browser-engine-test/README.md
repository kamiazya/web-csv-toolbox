# Browser Engine Test Suite

Interactive test suite for comparing web-csv-toolbox parsing engines (JavaScript, WASM, Worker, GPU).

## Features

- **Interactive UI**: Test each engine manually in the browser
- **Automated Tests**: Playwright-based tests for CI/CD integration
- **Headless GPU Testing**: WebGPU support in headless Chrome
- **Performance Benchmarks**: Compare parsing speed across engines
- **Cross-browser Testing**: Chromium, Firefox, and WebKit support

## Quick Start

```bash
# From repository root
pnpm install
pnpm run build

# Run this example
cd examples/browser-engine-test
pnpm install
pnpm dev          # Open http://localhost:5173 in browser
```

## Running Tests

### All Tests (Chromium only)

```bash
pnpm test
```

### With Browser UI (headed mode)

```bash
pnpm test:headed
```

### GPU Tests (Chromium with WebGPU)

```bash
pnpm test:gpu
```

### GPU Tests with Browser UI

```bash
pnpm test:gpu:headed
```

## Engine Comparison

| Engine | Backend | Context | Best For |
|--------|---------|---------|----------|
| **stable()** | JS | Main thread | Maximum compatibility |
| **recommended()** | WASM > JS | Worker > Main | Browser apps (default) |
| **turbo()** | GPU > WASM > JS | Main thread | Large files (>10MB) |

## Headless WebGPU Testing

WebGPU in headless Chrome requires specific flags. The Playwright configuration includes these automatically for the `chromium-gpu` project.

### Required Chrome Flags

```bash
--headless=new              # New headless mode
--use-angle=vulkan          # Use Vulkan backend for ANGLE
--enable-features=Vulkan    # Enable Vulkan
--disable-vulkan-surface    # Required for headless
--enable-unsafe-webgpu      # Enable WebGPU (experimental)
--disable-gpu-sandbox       # Stability
--no-sandbox                # Required in some environments
```

### Manual Testing

```bash
# Linux with NVIDIA GPU
google-chrome-stable \
  --headless=new \
  --use-angle=vulkan \
  --enable-features=Vulkan \
  --disable-vulkan-surface \
  --enable-unsafe-webgpu \
  --no-sandbox \
  --screenshot=/tmp/test.png \
  http://localhost:5173

# macOS (Metal backend)
/Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome \
  --headless=new \
  --enable-unsafe-webgpu \
  --screenshot=/tmp/test.png \
  http://localhost:5173
```

### Environment Variables

| Variable | Description |
|----------|-------------|
| `WEBGPU_TEST=1` | Enable GPU-specific tests |
| `CI=true` | CI mode (stricter test settings) |

### GPU Requirements

- **Linux**: Vulkan-capable GPU with up-to-date drivers
- **macOS**: Metal-capable GPU (M1/M2/Intel with Metal support)
- **Windows**: DirectX 12 capable GPU

### Troubleshooting

1. **"No GPU adapter available"**: GPU drivers may not support Vulkan/Metal
2. **"WebGPU not supported"**: Browser doesn't have WebGPU enabled
3. **Tests timeout**: GPU initialization may be slow; increase timeout

For more details, see:
- [Chrome WebGPU Troubleshooting](https://developer.chrome.com/docs/web-platform/webgpu/troubleshooting-tips)
- [Headless Chrome with GPU](https://developer.chrome.com/blog/supercharge-web-ai-testing)

## Project Structure

```
browser-engine-test/
├── index.html          # Test UI
├── index.ts            # Test implementation
├── vite.config.ts      # Vite configuration
├── playwright.config.ts # Playwright configuration
├── tests/
│   └── engine.spec.ts  # Playwright tests
├── package.json
├── tsconfig.json
└── README.md
```

## API Usage Examples

### JavaScript Engine (stable)

```typescript
import { parseString, EnginePresets } from 'web-csv-toolbox';

for await (const record of parseString(csv, {
  engine: EnginePresets.stable()
})) {
  console.log(record);
}
```

### WASM Engine

```typescript
for await (const record of parseString(csv, {
  engine: { wasm: true, worker: false, gpu: false }
})) {
  console.log(record);
}
```

### Worker Engine (recommended)

```typescript
import { ReusableWorkerPool, EnginePresets } from 'web-csv-toolbox';
import workerUrl from 'web-csv-toolbox/worker?url';

// TODO: When Node.js 24 becomes the minimum supported version, use:
// using pool = new ReusableWorkerPool({ maxWorkers: 2, workerURL: workerUrl });
const pool = new ReusableWorkerPool({
  maxWorkers: 2,
  workerURL: workerUrl,
});

try {
  for await (const record of parseString(csv, {
    engine: EnginePresets.recommended({ workerPool: pool })
  })) {
    console.log(record);
  }
} finally {
  pool.terminate();
}
```

### GPU Engine (turbo)

```typescript
import { parseBinaryStream, EnginePresets } from 'web-csv-toolbox';

const stream = new ReadableStream({
  start(controller) {
    controller.enqueue(new TextEncoder().encode(csv));
    controller.close();
  }
});

for await (const record of parseBinaryStream(stream, {
  engine: EnginePresets.turbo()
})) {
  console.log(record);
}
```

## CI/CD Integration

### GitHub Actions Example

```yaml
jobs:
  test-engines:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v2
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'pnpm'

      - run: pnpm install
      - run: pnpm build

      - name: Install Playwright browsers
        run: cd examples/browser-engine-test && pnpm exec playwright install --with-deps chromium

      - name: Run engine tests
        run: cd examples/browser-engine-test && pnpm test

      # GPU tests require special runners with GPU support
      # - name: Run GPU tests
      #   run: cd examples/browser-engine-test && pnpm test:gpu
```

## License

MIT
