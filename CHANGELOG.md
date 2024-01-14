# web-csv-toolbox

## 0.5.3

### Patch Changes

- [#50](https://github.com/kamiazya/web-csv-toolbox/pull/50) [`1956d13`](https://github.com/kamiazya/web-csv-toolbox/commit/1956d13c10c2dc782f51f5645ebff6acc1f395f1) Thanks [@kamiazya](https://github.com/kamiazya)! - Update GitHub workflows and package.json

- [#53](https://github.com/kamiazya/web-csv-toolbox/pull/53) [`9ceb572`](https://github.com/kamiazya/web-csv-toolbox/commit/9ceb5726aa3bf1d6e584bd68c167a91e46d6ebb6) Thanks [@kamiazya](https://github.com/kamiazya)! - This pull request integrates Deno, Node.js, and Browsers CI workflows as CI and adds Release and Prerelease workflows as CD. It also includes the integration of the doc workflow to the CD workflow. These changes aim to improve the development and deployment processes by automating the testing, building, and releasing of the software.

  - **New Features**
    - Introduced Continuous Deployment (CD) workflow for automated build and release processes.
    - Automated package deployment to npm.
    - Automated pre-release publishing.
    - Automated deployment of documentation to GitHub Pages.
  - **Refactor**
    - Improved Continuous Integration (CI) workflow to include building and testing across different environments and platforms.
  - **Chores**
    - Updated workflow names for better clarity.

## 0.5.2

### Patch Changes

- [`61ce41e`](https://github.com/kamiazya/web-csv-toolbox/commit/61ce41eae006cae6f3260f7d8a42371edb082f40) Thanks [@kamiazya](https://github.com/kamiazya)! - Update Release

## 0.5.1

### Patch Changes

- [#47](https://github.com/kamiazya/web-csv-toolbox/pull/47) [`8c7b4f8`](https://github.com/kamiazya/web-csv-toolbox/commit/8c7b4f8ae6b535489a002fa048b5a8c77b14072a) Thanks [@kamiazya](https://github.com/kamiazya)! - Create SECURITY.md

- [#42](https://github.com/kamiazya/web-csv-toolbox/pull/42) [`9274c24`](https://github.com/kamiazya/web-csv-toolbox/commit/9274c24a9e0670a10837255fdda95866031ac9f8) Thanks [@kamiazya](https://github.com/kamiazya)! - Implemented a new build configuration using Vite for enhanced development experience.

- [#40](https://github.com/kamiazya/web-csv-toolbox/pull/40) [`f0b4fa9`](https://github.com/kamiazya/web-csv-toolbox/commit/f0b4fa9eb57a68ba38223d5d85a829671b379df3) Thanks [@kamiazya](https://github.com/kamiazya)! - Reorder exports in package.json

- [#45](https://github.com/kamiazya/web-csv-toolbox/pull/45) [`0032e9b`](https://github.com/kamiazya/web-csv-toolbox/commit/0032e9bf8766f3f40256ae8427c29abe349a8e85) Thanks [@kamiazya](https://github.com/kamiazya)! - Create CODE_OF_CONDUCT.md

- [#43](https://github.com/kamiazya/web-csv-toolbox/pull/43) [`181f229`](https://github.com/kamiazya/web-csv-toolbox/commit/181f2292cb1e99a09fc40df5ea634cec8a618dc9) Thanks [@kamiazya](https://github.com/kamiazya)! - Fix typedoc config

- [#48](https://github.com/kamiazya/web-csv-toolbox/pull/48) [`81baca5`](https://github.com/kamiazya/web-csv-toolbox/commit/81baca57fda4c0203bc8c23a9ee7b4bf02fea1fb) Thanks [@kamiazya](https://github.com/kamiazya)! - Update web-csv-toolbox badges and import statement

## 0.5.0

### Minor Changes

- [`c9c5d8b`](https://github.com/kamiazya/web-csv-toolbox/commit/c9c5d8bbcb895878b051d118d0fb18269f5d51f6) Thanks [@kamiazya](https://github.com/kamiazya)! - Refactoring

  - **New Features**

    - Introduced `Lexer`, `RecordAssembler`, and `LexerTransformer` classes to enhance CSV parsing capabilities.
    - Added new methods (`toArraySync`, `toIterableIterator`, `toStream`) across various modules for flexible data processing.
    - Expanded `parseArrayBuffer`, `parseResponse`, `parseString`, and `parseUint8Array` with additional output formats.

  - **Bug Fixes**

    - Corrected typos in several modules, changing `quate` to `quote` and `demiliter` to `delimiter`.
    - Allowed `undefined` values in `CSVRecord` type to improve data handling.

  - **Refactor**

    - Simplified constructors and updated logic in `LexerTransformer` and `RecordAssemblerTransformer`.
    - Enhanced type safety with refactored token types in common types module.

  - **Tests**

    - Added and refactored test cases for `Lexer`, `RecordAssembler`, `LexerTransformer`, and `escapeField` to ensure reliability.

  - **Documentation**
    - Updated descriptions and examples for new methods in various modules to assist users in understanding their usage.

### Patch Changes

- [#34](https://github.com/kamiazya/web-csv-toolbox/pull/34) [`7b13862`](https://github.com/kamiazya/web-csv-toolbox/commit/7b1386211e7ee76d33d8f047079d068419461822) Thanks [@dependabot](https://github.com/apps/dependabot)! - build(deps-dev): bump vitest from 1.1.1 to 1.1.3

- [#33](https://github.com/kamiazya/web-csv-toolbox/pull/33) [`3d8f97a`](https://github.com/kamiazya/web-csv-toolbox/commit/3d8f97a7c40b630e1424fbebe827b2c9fe336ec4) Thanks [@dependabot](https://github.com/apps/dependabot)! - build(deps-dev): bump rollup from 4.9.1 to 4.9.4

- [#36](https://github.com/kamiazya/web-csv-toolbox/pull/36) [`1a72392`](https://github.com/kamiazya/web-csv-toolbox/commit/1a7239260985b29763da8c79c979fdbdd0aeef4c) Thanks [@dependabot](https://github.com/apps/dependabot)! - build(deps-dev): bump typedoc from 0.25.6 to 0.25.7

- [#35](https://github.com/kamiazya/web-csv-toolbox/pull/35) [`3b93b38`](https://github.com/kamiazya/web-csv-toolbox/commit/3b93b3829b79a2fc81718ee7d7f9bc430a609868) Thanks [@dependabot](https://github.com/apps/dependabot)! - build(deps-dev): bump typedoc-plugin-mdn-links from 3.1.10 to 3.1.11

- [#37](https://github.com/kamiazya/web-csv-toolbox/pull/37) [`476fa06`](https://github.com/kamiazya/web-csv-toolbox/commit/476fa0659e6b3b0c78c9c97832d26f8a73aa25f1) Thanks [@dependabot](https://github.com/apps/dependabot)! - build(deps-dev): bump @vitest/browser from 1.1.1 to 1.1.3

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
