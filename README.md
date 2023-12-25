# csv-toolbox

CSV Toolbox using Web Standard APIs.

## Key concepts

- Web Starndards first.
  - Using the [Web Streams API](https://streams.spec.whatwg.org/).
- TypeScript friendly & User friendly.
  - Fully typed and documented.
- Zero dependencies.
  - Using only Web Standards APIs.
- Propaty based tested.
  - Using [fast-check](https://fast-check.dev/) and [vitest](https://vitest.dev).
- **TBT** Cross platform.
  - Works on browsers and Node.js, Deno
    - Because it uses only Web Standards APIs, it should work on Deno.

## Key features

- Parses CSV files using the [WHATWG Streams API](https://streams.spec.whatwg.org/).
- Supports parsing CSV files from strings, `ReadableStream`s, and `Response` objects.
- Supports parsing CSV files with different delimiters and quotation characters.
  - Defaults to `,` and `"` respectively.
  - Supports parsing TSV files by setting `delimiter` to `\t`.
  - Supports parsing with mulit-character/multi-bytes delimiters and quotation characters.
- Supports parsing binary CSV files.

## Installation

```sh
npm install csv-toolbox
```

## Usage

### Parsing CSV files from strings

```js
import { parse } from 'csv-toolbox';

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

## Parsing CSV files from `ReadableStream`s

```js
import { parse } from 'csv-toolbox';

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
import { parse } from 'csv-toolbox';

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
import { parse } from 'csv-toolbox';

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

### Parsing CSV files with different headers

```js
import { parse } from 'csv-toolbox';

const csv = `Alice,42
Bob,69`;

for await (const record of parse(csv, { headers: ['name', 'age'] })) {
  console.log(record);
}
// Prints:
// { name: 'Alice', age: '42' }
// { name: 'Bob', age: '69' }
```

## API

### High-level APIs

#### `parse(input[, options]): AsyncIterableIterator<Record>` function

Returns an async iterable of records parsed from the given input.

##### `input` parameter

The input to parse. This can be a `string`, a `ReadableStream` of `string`s or `Uint8Array`s, or an `Resoponse` object.

##### `options` parameter

An optional object with the following properties:

###### `options.delimiter`

The character used to separate fields in the CSV input. Defaults to `,`.

###### `options.quotation`

The character used to quote fields in the CSV input. Defaults to `"`.

###### `options.headers`

An optional array of strings to use as the headers for the parsed records.

If not provided, the first record will be used as the headers.

###### `options.decompossion`

The decompossion to use when parsing the binary CSV input.

###### `options.charset`

The character set to use when parsing the binary CSV input.

###### `options.ignoreBOM`

Whether to ignore a leading BOM in the CSV input.
Defaults to `false`.

###### `options.fatal`

Whether to throw an error if the CSV input is invalid.
Defaults to `false`.

### Low-level APIs

TODO: See [the Source code](https://github.com/kamiazya/csv-toolbox) for now.

Code documentation is detailed and completed.

## License

[MIT](./LICENSE)
