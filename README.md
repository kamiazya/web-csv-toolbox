<div align="center">

[![npm version](https://badge.fury.io/js/web-csv-toolbox.svg)](https://badge.fury.io/js/web-csv-toolbox)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](http://makeapullrequest.com)
![node version](https://img.shields.io/node/v/web-csv-toolbox)
![npm](https://img.shields.io/npm/dm/web-csv-toolbox)

# `🌐 web-csv-toolbox 💽`

A CSV Toolbox utilizing Web Standard APIs.

🔗

[![GitHub](https://img.shields.io/badge/-GitHub-181717?logo=GitHub&style=flat)](https://github.com/kamiazya/web-csv-toolbox)
[![npm](https://img.shields.io/badge/-npm-CB3837?logo=npm&style=flat)](https://www.npmjs.com/package/web-csv-toolbox)
[![yarn](https://img.shields.io/badge/-yarn-ffffff?logo=Yarn&style=flat)](https://yarnpkg.com/package/web-csv-toolbox)
[![API Reference](https://img.shields.io/badge/-API%20Refarence-3178C6?logo=TypeScript&style=flat&logoColor=fff)](https://kamiazya.github.io/web-csv-toolbox/)
[![Sponsor](https://img.shields.io/badge/-GitHub%20Sponsor-fff?logo=GitHub%20Sponsors&style=flat)](https://github.com/sponsors/kamiazya)


[![format: Biome](https://img.shields.io/badge/format%20with-Biome-F7B911?logo=biome&style=flat)](https://biomejs.dev/)
[![test: Vitest](https://img.shields.io/badge/tested%20with-Vitest-6E9F18?logo=vitest&style=flat)](https://vitest.dev/)
[![build: Rollup](https://img.shields.io/badge/build%20with-Rollup-EC4A3F?logo=rollup.js&style=flat)](https://rollupjs.org/)

</div>

---

## Key Concepts ✨

- 🌐 **Web Standards first.**
  - Utilizing the Web Standards APIs, such as the [Web Streams API](https://developer.mozilla.org/en/docs/Web/API/Streams_API).
- ❤️ **TypeScript friendly & User friendly.**
  - Fully typed and documented.
- 0️⃣ **Zero dependencies.**
  - Using only Web Standards APIs.
- 💪 **Property-based testing.**
  - Using [fast-check](https://fast-check.dev/) and [vitest](https://vitest.dev).
- ✅ **Cross-platform.**
  - Works on browsers, Node.js, and Deno.

## Key Features 📗

- 🌊 **Efficient CSV Parsing with Streams**
  - 💻 Leveraging the [WHATWG Streams API](https://streams.spec.whatwg.org/) and other Web APIs for seamless and efficient data processing.
- 🎨 **Flexible Source Support**
  - 🧩 Parse CSVs directly from `string`s, `ReadableStream`s, or `Response` objects.
- ⚙️ **Advanced Parsing Options**: Customize your experience with various delimiters and quotation marks.
  - 🔄 Defaults to `,` and `"` respectively.
  - 🛠️ Use multi-character/multi-byte delimiters and quotations.
- 💾 **Specialized Binary CSV Parsing**: Leverage Stream-based processing for versatility and strength.
  - 🔄 Flexible BOM handling.
  - 🗜️ Supports various compression formats.
  - 🔤 Charset specification for diverse encoding.

## Installation 📥

### With Package manager 📦

This package can then be installed using a package manager.

```sh
# Install with npm
$ npm install web-csv-toolbox
# Or Yarn
$ yarn add web-csv-toolbox
# Or pnpm
$ pnpm add web-csv-toolbox
```

### From CDN (unpkg.com) 🌐

#### UMD Style 🔄

```html
<script src="https://unpkg.com/web-csv-toolbox"></script>
<script>
const csv = `name,age
Alice,42
Bob,69`;

(async function () {
  for await (const record of CSV.parse(csv)) {
    console.log(record);
  }
})();
</script>
```


#### ESModule Style 📦

```html
<script type="module">
import { parse } from 'https://unpkg.com/web-csv-toolbox/lib/index.js';

const csv = `name,age
Alice,42
Bob,69`;

for await (const record of parse(csv)) {
  console.log(record);
}
</script>
```

#### Deno 🦕

You can install and use the package by specifying the following:

```js
import { parse } from "npm:web-csv-toolbox";
```

## Usage 📘

### Parsing CSV files from strings

```js
import { parse } from 'web-csv-toolbox';

const csv = `name,age
Alice,42
Bob,69`;

for await (const record of parse(csv)) {
  console.log(record);
}
// Prints:
// { name: 'Alice', age: '42' }
// { name: 'Bob', age: '69' }
```

### Parsing CSV files from `ReadableStream`s

```js
import { parse } from 'web-csv-toolbox';

const csv = `name,age
Alice,42
Bob,69`;

const stream = new ReadableStream({
  start(controller) {
    controller.enqueue(csv);
    controller.close();
  },
});

for await (const record of parse(stream)) {
  console.log(record);
}
// Prints:
// { name: 'Alice', age: '42' }
// { name: 'Bob', age: '69' }
```

### Parsing CSV files from `Response` objects

```js
import { parse } from 'web-csv-toolbox';

const response = await fetch('https://example.com/data.csv');

for await (const record of parse(response)) {
  console.log(record);
}
// Prints:
// { name: 'Alice', age: '42' }
// { name: 'Bob', age: '69' }
```

### Parsing CSV files with different delimiters and quotation characters

```js
import { parse } from 'web-csv-toolbox';

const csv = `name\tage
Alice\t42
Bob\t69`;

for await (const record of parse(csv, { delimiter: '\t' })) {
  console.log(record);
}
// Prints:
// { name: 'Alice', age: '42' }
// { name: 'Bob', age: '69' }
```

### Parsing CSV files with headers

```js
import { parse } from 'web-csv-toolbox';

const csv = `Alice,42
Bob,69`;

for await (const record of parse(csv, { headers: ['name', 'age'] })) {
  console.log(record);
}
// Prints:
// { name: 'Alice', age: '42' }
// { name: 'Bob', age: '69' }
```

## Supported Runtimes 💻

### Works on Node.js [![Node.js CI](https://github.com/kamiazya/web-csv-toolbox/actions/workflows/node.js.yaml/badge.svg)](https://github.com/kamiazya/web-csv-toolbox/actions/workflows/node.js.yaml)

| Versions | Status |
| -------- | ------ |
| 20.x     | ✅     |
| 18.x     | ✅     |


### Works on Browser [![Browsers CI](https://github.com/kamiazya/web-csv-toolbox/actions/workflows/browsers.yaml/badge.svg)](https://github.com/kamiazya/web-csv-toolbox/actions/workflows/browsers.yaml)

| OS      | Chrome | FireFox | Default       |
| ------- | ------ | ------- | ------------- |
| Windows | ✅     | ✅      | ✅ (Edge)     |
| macos   | ✅     | ✅      | ⬜ (Safari *) |
| Linux   | ✅     | ✅      | -             |

> **\* To Be Tested**:  [I couldn't launch Safari in headless mode](https://github.com/vitest-dev/vitest/blob/main/packages/browser/src/node/providers/webdriver.ts#L39-L41) on GitHub Actions, so I couldn't verify it, but it probably works.

### Others

- Verify that JavaScript is executable on the Deno. [![Deno CI](https://github.com/kamiazya/web-csv-toolbox/actions/workflows/deno.yaml/badge.svg)](https://github.com/kamiazya/web-csv-toolbox/actions/workflows/deno.yaml)

## APIs 🧑‍💻

### High-level APIs 🚀

These APIs are designed for **Simplicity and Ease of Use**,
providing an intuitive and straightforward experience for users.

- **`function parse(input[, options]): AsyncIterableIterator<CSVRecord>`**: [📑](https://kamiazya.github.io/web-csv-toolbox/functions/parse-1.html)
  - Parses various CSV input formats into an asynchronous iterable of records.
- **`function parse.toArray(input[, options]): Promise<CSVRecord[]>`**: [📑](https://kamiazya.github.io/web-csv-toolbox/functions/parse.toArray.html)
  - Parses CSV input into an array of records, ideal for smaller data sets.

The `input` paramater can be a `string`, a [ReadableStream](https://developer.mozilla.org/docs/Web/API/ReadableStream)
of `string`s or [Uint8Array](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Uint8Array)s,
or a [Response](https://developer.mozilla.org/docs/Web/API/Response) object.

### Middle-level APIs 🧱

These APIs are optimized for **Enhanced Performance and Control**,
catering to users who need more detailed and fine-tuned functionality.

- **`function parseBinaryStream(stream[, options])`**: [📑](https://kamiazya.github.io/web-csv-toolbox/functions/parseBinaryStream-1.html)
  - Parses binary streams with precise control over data types.
- **`function parseResponse(response[, options])`**: [📑](https://kamiazya.github.io/web-csv-toolbox/functions/parseResponse-1.html)
  - Customized parsing directly from `Response` objects.
- **`function parseStream(stream[, options])`**: [📑](https://kamiazya.github.io/web-csv-toolbox/functions/parseStream-1.html)
  - Stream-based parsing for larger or continuous data.
- **`function parseString(string[, options])`**: [📑](https://kamiazya.github.io/web-csv-toolbox/functions/parseString-1.html)
  - Efficient parsing of CSV strings.
- **`function parseStringStream(stream[, options])`**: [📑](https://kamiazya.github.io/web-csv-toolbox/functions/parseStringStream-1.html)
  - Combines string-based parsing with stream processing.

### Low-level APIs ⚙️

These APIs are built for **Advanced Customization and Pipeline Design**,
ideal for developers looking for in-depth control and flexibility.

- **`class LexerTransformer`**: [📑](https://kamiazya.github.io/web-csv-toolbox/classes/LexerTransformer.html)
  - A TransformStream class for lexical analysis of CSV data.
- **`class RecordAssemblerTransformer`**: [📑](https://kamiazya.github.io/web-csv-toolbox/classes/RecordAssemblerTransformar.html)
  - Handles the assembly of parsed data into records.

## Options Configuration 🛠️

### Common Options ⚙️

| Option      | Description                           | Default   | Notes                                             |
| ----------- | ------------------------------------- | --------- | ------------------------------------------------- |
| `delimiter` | Character to separate fields          | `,`       |                                                   |
| `quotation` | Character used for quoting fields     | `"`       |                                                   |
| `headers`   | Custom headers for the parsed records | First row | If not provided, the first row is used as headers |

### Advanced Options (Binary-Specific) 🧬

| Option          | Description                                       | Default | Notes                                                                                                                                                     |
| --------------- | ------------------------------------------------- | ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `charset`       | Character encoding for binary CSV inputs          | `utf-8` | See [Encoding API Compatibility](https://developer.mozilla.org/en-US/docs/Web/API/Encoding_API/Encodings) for the encoding formats that can be specified. |
| `decompression` | Decompression algorithm for compressed CSV inputs |         | See [DecompressionStream Compatibility](https://developer.mozilla.org/en-US/docs/Web/API/DecompressionStream#browser_compatibilit).                       |
| `ignoreBOM`     | Whether to ignore Byte Order Mark (BOM)           | `false` | See [TextDecoderOptions.ignoreBOM](https://developer.mozilla.org/en-US/docs/Web/API/TextDecoderStream/ignoreBOM) for more information about the BOM.      |
| `fatal`         | Throw an error on invalid characters              | `false` | See [TextDecoderOptions.fatal](https://developer.mozilla.org/en-US/docs/Web/API/TextDecoderStream/fatal) for more information.                            |

## How to Contribute 💪

## Star ⭐

The easiest way to contribute is to use the library and star [repository](https://github.com/kamiazya/web-csv-toolbox/).

### Questions 💭

Feel free to ask questions on [GitHub Discussions](https://github.com/kamiazya/web-csv-toolbox/discussions).

### Report bugs / request additional features 💡

Please register at [GitHub Issues](https://github.com/kamiazya/web-csv-toolbox/issues/new/choose).

### Financial Support 💸

Please support [kamiazya](https://github.com/sponsors/kamiazya).

> Even just a dollar is enough motivation to develop 😊

## License ⚖️

This software is released under the MIT License, see [LICENSE](https://github.com/kamiazya/web-csv-toolbox?tab=MIT-1-ov-file).
