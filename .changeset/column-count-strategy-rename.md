---
"web-csv-toolbox": minor
---

**BREAKING CHANGE**: Restrict `columnCountStrategy` options for object output to `fill`/`strict` only.

Object format now rejects `keep` and `truncate` strategies at runtime, as these strategies are incompatible with object output semantics. Users relying on `keep` or `truncate` with object format must either:
- Switch to `outputFormat: 'array'` to use these strategies, or
- Use `fill` (default) or `strict` for object output

This change improves API clarity by aligning strategy availability with format capabilities and documenting the purpose-driven strategy matrix (including sparse/header requirements).
