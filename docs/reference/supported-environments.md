---
title: Supported Environments
group: Reference
---

# Supported Environments

This document outlines the environments where web-csv-toolbox is supported and the level of support provided for each.

## Quick Overview

### Legend

| Icon | Meaning |
|:----:|---------|
| ✅ | Full Support - Tested and officially supported |
| 🟡 | Active Support - Limited testing, active maintenance |
| 🔵 | Community Support - Not officially tested, best-effort support |
| ❌ | Not Supported - Feature unavailable or incompatible |
| N/A | Not Applicable - Platform combination doesn't exist |

### Support Matrix

| Environment | Linux | macOS | Windows | Support Tier | CI/CD Testing |
|-------------|:-----:|:-----:|:-------:|:------------:|:-------------:|
| **Chrome** | ✅ | ✅ | ✅ | Tier 1 | ✅ All platforms |
| **Firefox** | ✅ | ✅ | ✅ | Tier 1 | ✅ All platforms |
| **Edge** | 🔵 | 🔵 | ✅ | Tier 1 (Windows only) | ✅ Windows only |
| **Safari** | N/A | 🔵 | N/A | Tier 3 | ❌ No testing |
| **Node.js LTS** | ✅ | ✅ | ✅ | Tier 1 | ✅ Linux only* |
| **Deno LTS** | 🟡 | 🟡 | 🟡 | Tier 2 | ✅ Linux only* |
| **Bun** | 🔵 | 🔵 | 🔵 | Tier 3 | ❌ No testing |

\* Cross-platform runtimes tested on Linux only; other platforms supported due to inherent runtime compatibility

### Tier Summary

| Tier | Level | Environments | CI/CD Testing | Issue Priority |
|------|-------|--------------|---------------|----------------|
| **Tier 1** | Full Support | 10 combinations | Comprehensive | High |
| **Tier 2** | Active Support | 3 platforms (Deno) | Basic | Medium |
| **Tier 3** | Community Support | Various | None | Best-effort |

### Testing Coverage

| Category | Tested Combinations | Coverage |
|----------|---------------------|----------|
| **Browsers** | Chrome/Firefox (Linux, macOS, Windows) + Edge (Windows) = 7 | 7/9 major combinations |
| **Server Runtimes** | Node.js LTS (Linux) + Deno LTS (Linux) = 2 | 2/6 platform combinations |
| **Total** | 9 environment/platform combinations | Comprehensive |

**Testing Strategy:**
- **Browsers**: Multi-platform testing (Linux, macOS, Windows) due to platform-specific browser implementations
- **Server-side JS runtimes**: Linux-only testing sufficient due to inherent cross-platform design

## Support Tiers

### Tier 1: Full Support

Environments that are fully supported with comprehensive automated testing in CI/CD and priority issue resolution.

#### Browsers

**Fully Supported Browsers:**
- **Chrome**: Linux, macOS, Windows
- **Firefox**: Linux, macOS, Windows
- **Edge**: Windows only

**Platform Scope:**
- All supported browsers tested with **Transferable Streams** support
- CI/CD testing performed on all listed OS/browser combinations
- Other combinations (e.g., Edge on Linux/macOS, Safari on any platform) fall under **Community Support** (Tier 3)

**Version Support:**
- Only the **latest stable versions** of each browser are tested and supported
- Browsers auto-update, so we focus on current stable releases
- Older browser versions are not tested but may work due to backward compatibility

**Features:**
- Web Workers
- Streams API
- WebAssembly
- Transferable Streams (zero-copy)

**Testing:**
- Comprehensive unit tests
- Integration tests
- Automated CI/CD testing on every commit

#### Node.js

**Fully Supported Versions:**
- **Node.js 20.x** (LTS)
- **Node.js 22.x** (LTS)
- **Node.js 24.x** (Current)

**Platform Scope:**
- **All platforms supported**: Linux, macOS, and Windows
- **CI/CD testing**: Performed on **Linux only** (Ubuntu)
- **Cross-platform compatibility**: Node.js is designed for cross-platform compatibility; testing on Linux provides confidence for all platforms

**Support Policy:**
- **LTS versions (20.x, 22.x)**: Full support with comprehensive testing on Linux; cross-platform support for macOS and Windows
- **Current version (24.x)**: Full support during its active release phase
- **Non-LTS versions (odd-numbered: 21.x, 23.x, etc.)**: Community support only - may work but not officially tested or supported

**Why only LTS versions:**
Node.js follows a predictable release schedule where even-numbered versions (20, 22, 24) become LTS and receive long-term support, while odd-numbered versions (21, 23) are short-lived and never enter LTS. We focus our testing and support efforts on LTS versions to provide stable, long-term compatibility while keeping CI/CD complexity manageable.

**Why testing on Linux only:**
Node.js is designed for cross-platform compatibility. Testing on Linux provides confidence that the library works across all platforms, as platform-specific differences for our use cases (Streams, Workers, etc.) are minimal.

**Features:**
- Worker Threads
- Streams API
- Full encoding support (UTF-8, Shift-JIS, etc.)
- WebAssembly
- DecompressionStream

**Testing:**
- Comprehensive unit tests
- Integration tests
- Performance benchmarks
- Automated CI/CD testing on every commit

### Tier 2: Active Support

Environments that receive active support with limited automated testing.

#### Deno

**Supported Versions:**
- **Deno 2.x (Latest LTS)**: 🟡 Active Support - All platforms (Linux, macOS, Windows)
- **Deno 2.x (Non-LTS)**: 🔵 Community Support - Not tested
- **Deno 1.x**: 🔵 Community Support - Legacy version

**Platform Scope:**
- **All platforms supported**: Linux, macOS, and Windows (Latest LTS only)
- **CI/CD testing**: Performed on **Linux only** (Ubuntu)
- **Cross-platform compatibility**: Deno is designed for cross-platform compatibility; testing on Linux provides confidence for all platforms

**Support Policy:**
- **Latest LTS version only**: Active support with basic import test in CI/CD
- **Non-LTS versions**: Community support only - may work but not officially tested or supported
- **Legacy versions (1.x)**: Community support only - no longer tested

**Note on Deno LTS:**
Deno introduced LTS support starting with v2.1.0 (November 2024) with releases every six months. We only test and support the latest LTS version in CI/CD. LTS versions receive security patches and critical bug fixes from the Deno team.

For more information, see [Deno's Stability and Releases documentation](https://docs.deno.com/runtime/fundamentals/stability_and_releases/).

**Why limited support:**
While Deno should work with web-csv-toolbox due to Web API compatibility, we currently only perform basic import tests rather than comprehensive testing.

**Why testing on Linux only:**
Like Node.js, Deno is designed for cross-platform compatibility. Testing on Linux provides confidence that the library works across all platforms.

**Features:**
- Web Workers API
- Streams API
- Full encoding support
- WebAssembly

**Testing:**
- Basic import and functionality test
- No comprehensive test suite

### Tier 3: Community Support

Environments that are not officially tested but may work on a best-effort basis.

#### Safari

**Version:** Safari (Latest)

**Support Status:** 🔵 Community Support

**Key Limitations:**
- No Transferable Streams support (automatic fallback to message-streaming)
- Cannot run automated headless tests in CI/CD

**Status:**
- Should work with automatic fallback to message-streaming
- No automated testing in CI/CD due to technical limitations
- Headless Safari testing is not currently supported by Vitest's WebDriver provider
- No official support guarantee
- Community feedback welcome

**Known Limitations:**
- No Transferable Streams support (automatic fallback to message-streaming)
- Cannot run automated headless tests in CI/CD (technical limitation)

**Why Safari is not tested in CI/CD:**
Safari does not support headless mode with WebDriver, which is required for automated testing in CI/CD environments. This is a limitation of Safari's WebDriver implementation, not a limitation of this library.

#### Bun

**Version:** Bun 1.x

**Support Status:** 🔵 Community Support

**Status:**
- May work due to Node.js and Web API compatibility
- No automated testing
- No official support guarantee
- Community feedback welcome

#### Other Combinations

**Community Support (Not Tested):**
- **Edge on macOS/Linux** - Expected to work but not officially tested
- **Node.js non-LTS versions** (odd-numbered: 21.x, 23.x, etc.) - Any platform
- **Deno non-LTS versions** - Any platform

**Status:**
- Expected to work due to cross-platform nature of Web APIs and JavaScript runtimes
- No automated testing in CI/CD
- No official support guarantee
- Community feedback welcome

**Why not tested:**
- **Browsers (Chrome/Firefox/Edge)**: Now comprehensively tested across Linux, macOS, and Windows in CI/CD (Vitest 4 stable browser mode enabled headless testing and parallel execution)
- **Server-side JS runtimes (Node.js/Deno)**: Cross-platform by design; testing on Linux provides sufficient coverage for macOS and Windows
- **Edge on non-Windows platforms**: Edge is primarily a Windows browser; limited value in testing on other platforms
- **Non-LTS versions**: Focus on stable LTS releases for reliable long-term support
- **Test complexity**: Testing all possible combinations would exponentially increase CI/CD time and maintenance burden

**If you use these combinations:**
Please [report issues or success stories](https://github.com/kamiazya/web-csv-toolbox/issues) to help improve support. We especially welcome feedback about environment-specific issues on macOS and Windows.

## Feature Availability by Environment

### Worker Thread Support

| Environment | Status | Notes |
|-------------|--------|-------|
| Node.js LTS (All active LTS) | ✅ Tested | Worker Threads |
| Chrome/Firefox/Edge | ✅ Tested | Web Workers API |
| Deno LTS (Latest only) | 🟡 Basic Test Only | Web Workers API |
| Safari | 🔵 Untested | Web Workers API |
| Bun | 🔵 Untested | Unknown |

### Stream Transfer (Zero-Copy)

| Environment | Status | Notes |
|-------------|--------|-------|
| Node.js LTS (All active LTS) | ✅ Tested | Transferable Streams |
| Chrome | ✅ Tested | Transferable Streams |
| Firefox | ✅ Tested | Transferable Streams |
| Edge | ✅ Tested | Transferable Streams |
| Deno LTS (Latest only) | 🟡 Basic Test Only | Transferable Streams |
| Safari | ❌ Not Supported | Auto-fallback to message-streaming |
| Bun | 🔵 Untested | Unknown |

### WebAssembly

| Environment | Status | Notes |
|-------------|--------|-------|
| Node.js LTS (All active LTS) | ✅ Tested | Full WASM support |
| Chrome/Firefox/Edge | ✅ Tested | Full WASM support |
| Deno LTS (Latest only) | 🟡 Basic Test Only | Full WASM support |
| Safari | 🔵 Untested | Full WASM support (expected) |
| Bun | 🔵 Untested | Unknown |

**Limitations:**
- UTF-8 encoding only
- Single-byte ASCII delimiter and quotation only (multi-byte UTF-8 characters not supported)

### Encoding Support

| Environment | UTF-8 | Shift-JIS | EUC-JP | Other Encodings |
|-------------|-------|-----------|--------|-----------------|
| Node.js LTS (All active LTS) | ✅ Tested | ✅ Tested | ✅ Tested | ✅ Tested (via TextDecoder) |
| Chrome/Firefox/Edge | ✅ Tested | ✅ Tested | ✅ Tested | ✅ Tested (via TextDecoder) |
| Deno LTS (Latest only) | 🟡 Basic Test Only | 🟡 Basic Test Only | 🟡 Basic Test Only | 🟡 Basic Test Only |
| Safari | 🔵 Untested | 🔵 Untested | 🔵 Untested | 🔵 Untested |
| Bun | 🔵 Untested | 🔵 Untested | 🔵 Untested | 🔵 Untested |

**Note:** WebAssembly execution only supports UTF-8 encoding.

**Important:**
- **Node.js**: All active LTS versions (currently 20.x, 22.x, 24.x) are supported on all platforms (Linux, macOS, Windows). CI/CD testing on Linux only
- **Deno**: Only the **latest LTS version** is supported on all platforms (Linux, macOS, Windows). CI/CD testing on Linux only
- **Browsers**: Only the **latest stable versions** at the time of testing are officially supported (browsers auto-update, so older versions are not tested)
  - Chrome: Tested on Linux, macOS, and Windows
  - Firefox: Tested on Linux, macOS, and Windows
  - Edge: Tested on Windows only

**Testing Strategy:**
- **Server-side JS runtimes**: Linux-only testing provides cross-platform confidence due to inherent runtime compatibility
- **Browsers**: Multi-platform testing required due to platform-specific implementations

## Compatibility Notes

### Automatic Fallbacks

web-csv-toolbox automatically falls back to more compatible execution methods when needed:

1. **Stream Transfer → Message Streaming**: When Transferable Streams are not supported (e.g., Safari)
2. **WASM → JavaScript**: When using non-UTF-8 encoding or non-standard quotation characters

See [Automatic Fallback Behavior](../explanation/execution-strategies.md#automatic-fallback-behavior) for details.

### Platform-Specific Limitations

#### Node.js Worker Threads

**DecompressionStream:**
- ✅ Fully supported in Node.js LTS Worker Threads
- Can decompress gzip and deflate formats (deflate-raw is experimental and may vary by Node.js version)
- Works seamlessly with the `decompression` option in worker mode

```typescript
// ✅ Supported - decompress in worker thread
parseBinaryStream(compressedStream, {
  decompression: 'gzip',
  engine: { worker: true }
});
```

**References:**
- [Node.js Web Streams API Documentation](https://nodejs.org/api/webstreams.html) - Official Node.js documentation
- [Node.js Worker Threads Documentation](https://nodejs.org/api/worker_threads.html) - Official Node.js documentation
- [DecompressionStream - MDN](https://developer.mozilla.org/en-US/docs/Web/API/DecompressionStream)

#### Safari

**Transferable Streams:**
- Transferable Streams not supported
- Automatic fallback to message-streaming
- Slightly higher memory usage for large streams

**References:**
- [Transferable Streams - Can I Use](https://caniuse.com/mdn-api_readablestream_transferable)

## Testing Strategy

### Tier 1 (Full Support)
- Comprehensive unit tests
- Integration tests
- Performance benchmarks
- Automated CI/CD testing on every commit
- Regular security updates

### Tier 2 (Active Support)
- Basic functionality testing
- Automated CI/CD testing (limited scope)
- Issue tracking and resolution
- Best-effort maintenance

### Tier 3 (Community Support)
- No official testing
- Community-driven issue reports
- Best-effort bug fixes when reported

## Version Support Policy

We follow Node.js LTS release schedule for Tier 1 support:

- **Active LTS versions (even-numbered)**: Full support with comprehensive testing
- **Current release (even-numbered during active phase)**: Full support with comprehensive testing
- **Non-LTS versions (odd-numbered)**: Community support only - not tested or officially supported
- **Maintenance LTS**: Active support until EOL
- **EOL versions**: No support

**Node.js Release Schedule:**
Node.js follows a predictable release pattern where:
- **Even-numbered versions** (20, 22, 24) enter LTS and receive 30 months of active support + 18 months of maintenance
- **Odd-numbered versions** (21, 23, 25) are short-lived (6 months) and never enter LTS

We only test and support LTS versions to ensure stable, long-term compatibility. Non-LTS versions may work but receive no official support or testing.

See [Versioning Policy](./versioning-policy.md) for details on how we version the library.

## Getting Help

### For Tier 1 Environments
- [GitHub Issues](https://github.com/kamiazya/web-csv-toolbox/issues)
- Priority support for bugs and feature requests

### For Tier 2 Environments
- [GitHub Issues](https://github.com/kamiazya/web-csv-toolbox/issues)
- Best-effort support

### For Tier 3 Environments
- [GitHub Discussions](https://github.com/kamiazya/web-csv-toolbox/discussions)
- Community support only

## Contributing

If you're using web-csv-toolbox in an environment not listed here or want to improve support for Tier 3 environments, we welcome contributions:

- Report issues and success stories
- Submit PRs for compatibility improvements
- Help with testing and documentation

See [CONTRIBUTING.md](https://github.com/kamiazya/web-csv-toolbox/blob/main/CONTRIBUTING.md) for guidelines.
