<div align="center">

[![npm version](https://badge.fury.io/js/web-csv-toolbox.svg)](https://badge.fury.io/js/web-csv-toolbox)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](http://makeapullrequest.com)
![node version](https://img.shields.io/node/v/web-csv-toolbox)
[![FOSSA Status](https://app.fossa.com/api/projects/git%2Bgithub.com%2Fkamiazya%2Fweb-csv-toolbox.svg?type=shield)](https://app.fossa.com/projects/git%2Bgithub.com%2Fkamiazya%2Fweb-csv-toolbox?ref=badge_shield)
![npm package minimized gzipped size](https://img.shields.io/bundlejs/size/web-csv-toolbox)
![GitHub code size in bytes](https://img.shields.io/github/languages/code-size/kamiazya/web-csv-toolbox)
![npm](https://img.shields.io/npm/dm/web-csv-toolbox)
[![codecov](https://codecov.io/gh/kamiazya/web-csv-toolbox/graph/badge.svg?token=8RbDcXHTFl)](https://codecov.io/gh/kamiazya/web-csv-toolbox)

# `🌐 web-csv-toolbox 🧰`

A CSV Toolbox utilizing Web Standard APIs.

🔗
[![GitHub](https://img.shields.io/badge/-GitHub-181717?logo=GitHub&style=flat)](https://github.com/kamiazya/web-csv-toolbox)
[![npm](https://img.shields.io/badge/-npm-CB3837?logo=npm&style=flat)](https://www.npmjs.com/package/web-csv-toolbox)
[![API Reference](https://img.shields.io/badge/-API%20Reference-3178C6?logo=TypeScript&style=flat&logoColor=fff)](https://kamiazya.github.io/web-csv-toolbox/)
[![Ask DeepWiki](https://deepwiki.com/badge.svg)](https://deepwiki.com/kamiazya/web-csv-toolbox)
[![Sponsor](https://img.shields.io/badge/-GitHub%20Sponsor-fff?logo=GitHub%20Sponsors&style=flat)](https://github.com/sponsors/kamiazya)
[![CodSpeed Badge](https://img.shields.io/endpoint?url=https://codspeed.io/badge.json)](https://codspeed.io/kamiazya/web-csv-toolbox)
[![format: Biome](https://img.shields.io/badge/format%20with-Biome-F7B911?logo=biome&style=flat)](https://biomejs.dev/)
[![test: Vitest](https://img.shields.io/badge/tested%20with-Vitest-6E9F18?logo=vitest&style=flat)](https://vitest.dev/)
[![build: Vite](https://img.shields.io/badge/build%20with-Vite-646CFF?logo=vite&style=flat)](https://rollupjs.org/)

</div>

> [!NOTE]
> This is the documentation for v1 (v1.0.0-alpha.0 ~ ).
> If you are using v0, please refer to [v0 documentation](https://github.com/kamiazya/web-csv-toolbox/tree/v0.x).

---

## Key Concepts ✨

- 🌐 **Web Standards first.**
  - Utilizing the Web Standards APIs, such as the [Web Streams API](https://developer.mozilla.org/en/docs/Web/API/Streams_API).
- 📦 **Lightweight & Fast.**
  - Small bundle size and fast performance by using Web Standards APIs.
- 🔄 **Composable.**
  - Web Standard APIs based, so it can be easily integrated with other APIs.

## Roadmap 🛤️

The following features are not yet supported, but are planned for future releases:

- Parsing CSV data with **double-quote escapes** and **multi-line strings**
- **Dynamic header detection** & **inferring schema**
- **Automatic data conversion** to appropriate types

Additionally, the CSV Toolbox aims to provide a comprehensive and flexible solution for CSV data manipulation. More features will be added in future updates.

## Packages 📦

| Package                                                                                           | Description                                                                                   |
| ------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| [web-csv-toolbox](https://github.com/kamiazya/web-csv-toolbox/tree/main/packages/web-csv-toolbox) | Core library for parsing, serializing, and transforming CSV data using Web Standards APIs.    |

## Installation 💻

### Using npm

```sh
npm install web-csv-toolbox
```

### Using Yarn

```sh
yarn add web-csv-toolbox
```

### Using pnpm

```sh
pnpm add web-csv-toolbox
```

### Using Bun

```sh
bun add web-csv-toolbox
```

### Using Deno

#### Via JSR

```sh
deno add @yajamon/web-csv-toolbox
```

```typescript
import { } from "@yajamon/web-csv-toolbox";
```

#### Via esm.sh

```typescript
import { } from "https://esm.sh/web-csv-toolbox";
```

## Usage 🔧

### Parsing CSV

Example 1: Parsing a CSV file from a URL

```typescript
import { parseCSV } from 'web-csv-toolbox';

const response = await fetch('https://example.com/data.csv');

for await (const record of parseCSV(response.body)) {
  console.log(record);
}
```

Example 2: Parsing a CSV file from a local file

```typescript
import { parseCSV } from 'web-csv-toolbox';

const file = await Deno.open('data.csv');

for await (const record of parseCSV(file.readable)) {
  console.log(record);
}
```

Example 3: Parsing a CSV string

```typescript
import { parseStringToArraySync } from 'web-csv-toolbox';

const csv = 'name,age\nAlice,20\nBob,25';
const records = parseStringToArraySync(csv);

console.log(records);
// [
//   { name: 'Alice', age: '20' },
//   { name: 'Bob', age: '25' },
// ]
```

### Serializing to CSV

Example 1: Serializing an array of objects to CSV string

```typescript
import { stringifyToString } from 'web-csv-toolbox';

const records = [
  { name: 'Alice', age: '20' },
  { name: 'Bob', age: '25' },
];

const csv = stringifyToString(records);

console.log(csv);
// name,age
// Alice,20
// Bob,25
```

Example 2: Serializing an array of objects to CSV file

```typescript
import { stringifyToStream } from 'web-csv-toolbox';

const records = [
  { name: 'Alice', age: '20' },
  { name: 'Bob', age: '25' },
];

const stream = stringifyToStream(records);
const file = await Deno.create('output.csv');

await stream.pipeTo(file.writable);
```

## API Documentation 📚

For detailed API documentation, please refer to the [API Reference](https://kamiazya.github.io/web-csv-toolbox/).

## Options 🛠️

### Common Options for Binary Input

Binary inputs such as `ReadableStream<Uint8Array>` have the following options:

| Option          | Description                                       | Default  | Note                                                                                                                                 |
| --------------- | ------------------------------------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `charset`       | Character encoding for binary CSV inputs          | `utf-8`  | See [Encoding API Compatibility](https://developer.mozilla.org/en-US/docs/Web/API/Encoding_API/Encodings) for the encoding formats that can be specified. |
| `decompression` | Decompression algorithm for compressed CSV inputs |          | See [DecompressionStream Compatibility](https://developer.mozilla.org/en-US/docs/Web/API/DecompressionStream#browser_compatibilit).                       |
| `ignoreBOM`     | Whether to ignore Byte Order Mark (BOM)           | `false`  | See [TextDecoderOptions.ignoreBOM](https://developer.mozilla.org/en-US/docs/Web/API/TextDecoderStream/ignoreBOM) for more information about the BOM.      |
| `fatal`         | Throw an error on invalid characters              | `false`  | See [TextDecoderOptions.fatal](https://developer.mozilla.org/en-US/docs/Web/API/TextDecoderStream/fatal) for more information.                            |

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

[![FOSSA Status](https://app.fossa.com/api/projects/git%2Bgithub.com%2Fkamiazya%2Fweb-csv-toolbox.svg?type=large)](https://app.fossa.com/projects/git%2Bgithub.com%2Fkamiazya%2Fweb-csv-toolbox?ref=badge_large)

Contributed by Ardelyo for GitHub Achievement
