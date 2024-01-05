# web-csv-toolbox

## 0.4.0

### Minor Changes

- [#30](https://github.com/kamiazya/web-csv-toolbox/pull/30) [`9f9117b`](https://github.com/kamiazya/web-csv-toolbox/commit/9f9117b133085cb2f54458870088626607ab21fb) Thanks [@kamiazya](https://github.com/kamiazya)! - - **New Features**

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

## 0.3.2

### Patch Changes

- [`9ef79d2`](https://github.com/kamiazya/web-csv-toolbox/commit/9ef79d2a1286821580c974e1393ad464ffdb1343) Thanks [@kamiazya](https://github.com/kamiazya)! - Enhanced the extractQuotedString method in text processing to handle specific conditions more accurately.

- [#27](https://github.com/kamiazya/web-csv-toolbox/pull/27) [`196d562`](https://github.com/kamiazya/web-csv-toolbox/commit/196d56226afcedf054476955f9b3fbc9745a4efc) Thanks [@dependabot](https://github.com/apps/dependabot)! - Some devDependencies updates.

## 0.3.1

### Patch Changes

- [#21](https://github.com/kamiazya/web-csv-toolbox/pull/21) [`e5480ba`](https://github.com/kamiazya/web-csv-toolbox/commit/e5480bacddf29b6cce7c1f0b8d426c99f5c9e0ba) Thanks [@kamiazya](https://github.com/kamiazya)! - fix: add instalation docs for CSN and Deno

- [#19](https://github.com/kamiazya/web-csv-toolbox/pull/19) [`5f0b861`](https://github.com/kamiazya/web-csv-toolbox/commit/5f0b86110b92f6e2c8b747341e424f6a7944d57b) Thanks [@kamiazya](https://github.com/kamiazya)! - Cross platform tests

## 0.3.0

### Minor Changes

- [#18](https://github.com/kamiazya/web-csv-toolbox/pull/18) [`cd5b9b9`](https://github.com/kamiazya/web-csv-toolbox/commit/cd5b9b9959039ac3e89e5e00a1a46614266ee882) Thanks [@kamiazya](https://github.com/kamiazya)! - feat: add support cdn

### Patch Changes

- [#16](https://github.com/kamiazya/web-csv-toolbox/pull/16) [`d8cbb1f`](https://github.com/kamiazya/web-csv-toolbox/commit/d8cbb1fc8e03fe5ee5986721a8b52378894f37bc) Thanks [@kamiazya](https://github.com/kamiazya)! - ci: fix snapshot release flow

## 0.2.0

### Minor Changes

- [#14](https://github.com/kamiazya/web-csv-toolbox/pull/14) [`8f2590e`](https://github.com/kamiazya/web-csv-toolbox/commit/8f2590e188f085808df05d5651f4999f86c4b22c) Thanks [@kamiazya](https://github.com/kamiazya)! - - Add more detailed documents.
  - Fixed a naming conventions problem in the documentation.
    - Changed `streamingParse` to `parseString`.

## 0.1.0

### Minor Changes

- [#12](https://github.com/kamiazya/web-csv-toolbox/pull/12) [`50475b3`](https://github.com/kamiazya/web-csv-toolbox/commit/50475b3f6be49e52a646eed389e72fe6efe0140d) Thanks [@kamiazya](https://github.com/kamiazya)! - doc: Publish TypeDoc to GitHub Pages

### Patch Changes

- [#11](https://github.com/kamiazya/web-csv-toolbox/pull/11) [`b48c782`](https://github.com/kamiazya/web-csv-toolbox/commit/b48c7829e5e3af1e986b3c32ffc12f41bab78e99) Thanks [@kamiazya](https://github.com/kamiazya)! - ci: add snapshot release

- [#6](https://github.com/kamiazya/web-csv-toolbox/pull/6) [`e183d61`](https://github.com/kamiazya/web-csv-toolbox/commit/e183d619c34cdcc6c9317454f7b84b02c8ba8e59) Thanks [@kamiazya](https://github.com/kamiazya)! - Create dependabot.yml

- [#13](https://github.com/kamiazya/web-csv-toolbox/pull/13) [`761c533`](https://github.com/kamiazya/web-csv-toolbox/commit/761c5336d410a1f288f844bc1f248fc4abc19fd7) Thanks [@kamiazya](https://github.com/kamiazya)! - ci: add GitHub Release after release

## 0.0.2

### Patch Changes

- 4be404f: ci: add build step before release

## 0.0.1

### Patch Changes

- 5402d6a: Initial Release for `web-csv-toolbox`, what is A CSV Toolbox utilizing Web Standard APIs.

  ## Key concepts

  - Web Standards first.
    - Using the [Web Streams API](https://streams.spec.whatwg.org/).
  - TypeScript friendly & User friendly.
    - Fully typed and documented.
  - Zero dependencies.
    - Using only Web Standards APIs.
  - Property-based testing.
    - Using [fast-check](https://fast-check.dev/) and [vitest](https://vitest.dev).
  - **To Be Tested** Cross platform.
    - Works on browsers and Node.js, Deno
      - Only web standard APIs are used, so it should work with these Runtimes.

  ## Key features

  - Parses CSV files using the [WHATWG Streams API](https://streams.spec.whatwg.org/).
  - Supports parsing CSV files from strings, `ReadableStream`s, and `Response` objects.
  - Supports parsing CSV files with different delimiters and quotation characters.
    - Defaults to `,` and `"` respectively.
    - Supports parsing TSV files by setting `delimiter` to `\t`.
    - Supports parsing with multi-character/multi-byte delimiters and quotation characters.
  - Supports parsing binary CSV files.
