---
"web-csv-toolbox": minor
---

## Lexer API Changes

This release includes low-level Lexer API changes for performance optimization.

### Breaking Changes (Low-level API only)

These changes only affect users of the low-level Lexer API. **High-level APIs (`parseString`, `parseBinary`, etc.) are unchanged.**

1. **Token type constants**: Changed from `Symbol` to numeric constants
2. **Location tracking**: Now disabled by default. Add `trackLocation: true` to Lexer options if you need token location information. Note: Error messages still include position information even when `trackLocation: false` (computed lazily only when errors occur).
3. **Struct of token objects**: Changed to improve performance. Token properties changed and reduce tokens by combining delimiter and newline information into a field.

### Who is affected?

**Most users are NOT affected.** Only users who directly use `FlexibleStringCSVLexer` and rely on `token.location` or `Symbol`-based token type comparison need to update their code.
