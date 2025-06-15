---
"web-csv-toolbox": patch
---

Upgrade dev dependencies

- Add wasm-pack to 0.13
- Updated biome to 1.9
- Updated typedoc to 0.28
- Updated TypeScript to 5.8
- Updated Vite to 6.3
- Updated vite-plugin-dts to 4.5
- Updated vitest to 3.2
- Updated webdriverio to 9.15

## Summary of Changes

- Added `hexa` function for generating hexadecimal strings.
- Introduced `unicode` and `unicodeMapper` functions for better Unicode string handling.
- Updated `text` function to utilize new string generation methods for "hexa", "unicode", and "string16bits".
- Cleaned up snapshot tests in `parseResponse.spec.ts` and `parseResponseToStream.spec.ts` by removing unnecessary comments.
- Created a new declaration file for the `web-csv-toolbox-wasm` module to improve type safety.
- Modified `tsconfig.json` to exclude all test files from compilation, improving build performance.
