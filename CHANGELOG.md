# web-csv-toolbox

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
