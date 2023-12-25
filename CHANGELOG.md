# web-csv-toolbox

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
