---
"web-csv-toolbox": patch
---

Improve GitHub Actions security

- Pin all GitHub Actions to commit hashes to prevent tag-sliding attacks
- Update all actions to latest versions with pinned hashes using pinact
- Add required `mode: instrumentation` parameter to CodSpeed action configuration
- Update Node.js version in .node-version to 24
