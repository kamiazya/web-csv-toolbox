---
web-csv-toolbox: patch
---

Expand browser testing coverage and improve documentation

**Testing Infrastructure Improvements:**

- **macOS Browser Testing**: Added Chrome and Firefox testing on macOS in CI/CD
  - Vitest 4 stable browser mode enabled headless testing on macOS
  - Previously blocked due to Safari headless limitations
- **Parallel Browser Execution**: Multiple browsers now run in parallel within each OS job
  - Linux: Chrome + Firefox in parallel
  - macOS: Chrome + Firefox in parallel
  - Windows: Chrome + Firefox + Edge in parallel
- **Dynamic Browser Configuration**: Browser instances automatically determined by platform
  - Uses `process.platform` to select appropriate browsers
  - Eliminates need for environment variables

**Documentation Improvements:**

- **Quick Overview Section**: Added comprehensive support matrix and metrics
  - Visual support matrix showing all environment/platform combinations
  - Tier summary with coverage statistics
  - Testing coverage breakdown by category
  - Clear legend explaining all support status icons
- **Clearer Support Tiers**: Improved distinction between support levels
  - ✅ Full Support (Tier 1): Tested and officially supported
  - 🟡 Active Support (Tier 2): Limited testing, active maintenance
  - 🔵 Community Support (Tier 3): Not tested, best-effort support
- **Cross-Platform Runtime Support**: Clarified Node.js and Deno support across all platforms
  - Node.js LTS: Tier 1 support on Linux, macOS, and Windows
  - Deno LTS: Tier 2 support on Linux, macOS, and Windows
  - Testing performed on Linux only due to cross-platform runtime design
  - Eliminates unnecessary concern about untested platforms
- **Simplified Tables**: Converted redundant tables to concise bullet lists
  - Removed repetitive "Full Support" entries
  - Easier to scan and understand

**Browser Testing Coverage:**

- Chrome: Tested on Linux, macOS, and Windows (Tier 1)
- Firefox: Tested on Linux, macOS, and Windows (Tier 1)
- Edge: Tested on Windows only (Tier 1)
- Safari: Community support (headless mode not supported by Vitest)

**Breaking Changes:**

None - this release only improves testing infrastructure and documentation.
