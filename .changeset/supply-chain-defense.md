---
"web-csv-toolbox": patch
---

## Supply Chain Attack Defense

Added multi-layered protection against npm supply chain attacks (such as Shai-Hulud 2.0).

### Defense Layers

1. **New Package Release Delay**: Blocks packages published within 48 hours via `minimumReleaseAge` setting
2. **Install Script Prevention**: Disables preinstall/postinstall scripts via `ignore-scripts=true`
3. **Continuous Vulnerability Scanning**: Integrates OSV-Scanner into CI/CD pipeline

These changes only affect the development environment and CI/CD configuration. No changes to library code.
