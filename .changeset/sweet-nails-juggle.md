---
"web-csv-toolbox": minor
---

- **New Features**
  - Introduced support for `Uint8Array` and `ArrayBuffer` input parameters for CSV parsing.
  - Added new parsing functions for `Uint8Array` and `ArrayBuffer` inputs.
  - Enhanced parsing capabilities to handle various CSV data representations.

- **Documentation**
  - Updated README to reflect support for new input types and parsing functions.

- **Tests**
  - Added test suites for `parseArrayBuffer`, `parseUint8Array`, and `parseUint8ArrayStream` functions.

- **Refactor**
  - Renamed `parseBinaryStream` to `parseUint8ArrayStream`.
  - Updated exported symbols and namespaces to align with the new functionality.
  - Modified existing parsing functions to accommodate new CSV data types.

- **Style**
  - Adjusted enumerable and read-only property definitions using `Object.defineProperty` for consistency across namespaces.
