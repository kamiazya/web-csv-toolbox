---
title: Versioning Policy
group: Reference
---

# Versioning Policy

This document outlines the versioning strategy for web-csv-toolbox and what users can expect from version updates.

## Semantic Versioning

web-csv-toolbox follows [Semantic Versioning 2.0.0](https://semver.org/). Version numbers follow the format:

```
MAJOR.MINOR.PATCH
```

### Version Components

- **MAJOR**: Introduces backward-incompatible changes
- **MINOR**: Adds functionality in a backward-compatible manner
- **PATCH**: Fixes bugs in a backward-compatible manner

## Pre-1.0 (Current: 0.x.x)

**Status**: The library is currently in pre-1.0 development.

### What This Means

During the 0.x.x phase:
- **Breaking changes may occur in MINOR versions** (e.g., 0.12.0 → 0.13.0)
- PATCH versions (e.g., 0.12.0 → 0.12.1) remain backward-compatible
- APIs are subject to change based on user feedback and real-world usage

### Experimental Features

The following features are currently experimental and their APIs may change:
- Worker Thread execution
- WebAssembly execution
- Engine configuration options

### Stability Levels

| Feature | Stability | Notes |
|---------|-----------|-------|
| Main Thread parsing | ✅ Stable | Core parsing API unlikely to change |
| CSV format options | ✅ Stable | Standard options (delimiter, quotation, etc.) |
| Worker execution | ⚠️ Experimental | API may change in minor versions |
| WASM execution | ⚠️ Experimental | API may change in minor versions |
| Engine presets | ⚠️ Experimental | New presets may be added, existing may change |

### Recommendations for Pre-1.0

1. **Pin to specific minor versions** in production:
   ```json
   {
     "dependencies": {
       "web-csv-toolbox": "0.12.0"
     }
   }
   ```
   Instead of:
   ```json
   {
     "dependencies": {
       "web-csv-toolbox": "^0.12.0"
     }
   }
   ```

2. **Review CHANGELOG** before upgrading minor versions

3. **Test thoroughly** when upgrading to new minor versions

4. **Report issues** to help stabilize APIs before 1.0

## Post-1.0 (Future)

Once we reach version 1.0.0, we will strictly follow Semantic Versioning:

### MAJOR Version (X.0.0)

Breaking changes that may require code updates:
- Removal of deprecated APIs
- Changes to core parsing behavior
- Changes to function signatures
- Changes to return types

**Migration Support:**
- Deprecation warnings in previous MINOR versions
- Migration guides in release notes
- Detailed CHANGELOG entries

### MINOR Version (1.X.0)

New features and enhancements without breaking existing code:
- New parsing options
- New execution strategies
- New utility functions
- Performance improvements
- New engine presets

**Guarantees:**
- Backward-compatible
- No breaking changes to existing APIs
- Safe to upgrade without code changes

### PATCH Version (1.0.X)

Bug fixes and minor improvements:
- Bug fixes
- Documentation updates
- Performance optimizations (non-breaking)
- Security patches

**Guarantees:**
- Backward-compatible
- No new features
- Safe to upgrade immediately

## Special Considerations

### TypeScript Type Definitions

TypeScript type definitions are part of the public API, but have special versioning considerations:

- **MAJOR**: Intentional breaking changes to type definitions
- **MINOR**: May include breaking changes to TypeScript type definitions due to:
  - TypeScript introducing breaking changes in its own minor updates
  - Adopting features available only in newer TypeScript versions
  - Raising the minimum required TypeScript version
  - New types, expanded unions, new optional properties
- **PATCH**: Type fixes that don't change behavior

**Why TypeScript Breaking Changes in MINOR Versions:**

TypeScript itself may introduce breaking changes in minor version updates. When we adopt newer TypeScript features or respond to TypeScript's own breaking changes, we may need to update type definitions in a way that breaks compatibility with older TypeScript versions.

**Recommendation:**
- **Pin the web-csv-toolbox minor version** (not just patch) to control upgrade timing
- Test type compatibility when upgrading to new minor versions
- Upgrade TypeScript version in your project as needed to match library requirements

### Dependency Updates

Dependency updates follow these rules:

- **Security patches**: May be included in PATCH versions even if they change behavior slightly
- **Major dependency updates**: Only in MAJOR versions
- **Minor dependency updates**: May be included in MINOR versions if backward-compatible

### Runtime Environment Support

Changes to supported runtime environments are versioned based on the tier of support and impact:

#### Node.js Version Support

Node.js is our primary supported runtime, and we follow strict versioning rules:

- **Dropping Node.js LTS versions that reach EOL**: MAJOR version
- **Adding support for new Node.js LTS versions**: MINOR version
- **Non-LTS Node.js versions (odd-numbered)**: No versioning guarantee - community support only

**Example Timeline:**
```
Node.js 18.x reaches EOL (April 2025)
→ web-csv-toolbox 1.0.0 drops Node.js 18.x support
→ Next release: 2.0.0 (MAJOR bump)

Node.js 26.x enters LTS (October 2025)
→ web-csv-toolbox 2.1.0 adds Node.js 26.x support
→ Next release: 2.1.0 (MINOR bump)
```

#### Browser Version Support

Browsers auto-update and don't follow semver, so our policy is:

- **Dropping support for EOL browsers**: MAJOR version
- **Adding support for new browsers**: MINOR version
- **Adjusting minimum browser version requirements**: MAJOR version

We follow [Browserslist's default query](https://github.com/browserslist/browserslist#best-practices) for modern browser support.

#### Other Runtime Environments

For Deno, Bun, and other runtimes:

- **Changes to Tier 2 (Active Support) environments**: MINOR version
- **Changes to Tier 3 (Community Support) environments**: No versioning guarantee
- **Fixing environment-specific bugs**: PATCH version (all tiers)

**Rationale:**
Tier 1 (Node.js and browsers) have predictable release schedules and EOL dates, allowing us to provide stable versioning guarantees. Tier 2 and Tier 3 environments are less predictable, so we provide best-effort support without strict versioning guarantees.

See [Supported Environments](./supported-environments.md) for current support matrix and tier definitions.

## Deprecation Policy

**Applies to: v1.0.0 and later only**

During the pre-1.0 phase (0.x.x), APIs may change in MINOR versions without deprecation warnings. Once we reach 1.0.0, we follow a formal deprecation policy.

### Post-1.0 Deprecation Process

When we need to remove or change an API in v1.0.0+:

1. **Deprecation Warning** (MINOR version)
   - Mark API as deprecated in documentation
   - Add runtime deprecation warnings (when feasible)
   - Provide alternative APIs

2. **Deprecation Period** (At least 1 MINOR version)
   - Deprecated APIs continue to work
   - Documentation shows migration path
   - Users have time to update their code

3. **Removal** (Next MAJOR version)
   - Deprecated APIs are removed
   - Migration guide provided
   - Breaking change documented in CHANGELOG

### Example Timeline

```
v1.5.0 - Feature X deprecated, Feature Y added as replacement
v1.6.0 - Feature X still works with deprecation warning
v1.7.0 - Feature X still works with deprecation warning
v2.0.0 - Feature X removed, Feature Y is the standard way
```

### Pre-1.0 Behavior

During 0.x.x versions, we may introduce breaking changes in MINOR versions without deprecation warnings. See [Pre-1.0 (Current: 0.x.x)](#pre-10-current-0xx) section for details.

## Release Cadence

We do not have a fixed release schedule, but generally:

- **PATCH releases**: As needed for bug fixes (days to weeks)
- **MINOR releases**: Every 1-3 months for new features
- **MAJOR releases**: When significant breaking changes are needed (no fixed schedule)

## Communication

### Release Notes

Every release includes:
- Detailed CHANGELOG entry
- GitHub release notes
- Breaking changes highlighted
- Migration guides for MAJOR versions

### Channels

Stay informed about releases:
- [GitHub Releases](https://github.com/kamiazya/web-csv-toolbox/releases)
- [CHANGELOG.md](https://github.com/kamiazya/web-csv-toolbox/blob/main/CHANGELOG.md)
- [GitHub Discussions](https://github.com/kamiazya/web-csv-toolbox/discussions)

## Version Support

### Active Support

We actively maintain:
- **Latest MAJOR version**: Full support
- **Previous MAJOR version**: Security fixes for 6 months after new MAJOR release

### End of Life (EOL)

Versions older than the previous MAJOR version:
- No bug fixes
- No security patches
- Users encouraged to upgrade

## Migration Support

For MAJOR version upgrades, we provide:

1. **Migration Guide**: Step-by-step instructions
2. **Code Examples**: Before/after comparisons
3. **Community Support**: GitHub Discussions for questions

## Reporting Issues

If you encounter issues with versioning:

1. Check [CHANGELOG.md](https://github.com/kamiazya/web-csv-toolbox/blob/main/CHANGELOG.md)
2. Search [existing issues](https://github.com/kamiazya/web-csv-toolbox/issues)
3. Report new issues with version information

## Questions?

For questions about our versioning policy:
- [GitHub Discussions](https://github.com/kamiazya/web-csv-toolbox/discussions)
- [GitHub Issues](https://github.com/kamiazya/web-csv-toolbox/issues)
