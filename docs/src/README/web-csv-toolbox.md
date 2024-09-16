{% layout "layouts/README" %}
{% block content %}
## Key Concepts ✨
{% include 'common/key-concepts' %}
## Key Features 📗
{% include 'common/key-features' %}

## Installation 📥

### With Package manager 📦

{% render 'common/installation-with-package-manager', name: name %}

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
import { parse } from 'https://unpkg.com/web-csv-toolbox?module';

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

### `AbortSignal` / `AbortController` Support

Support for [`AbortSignal`](https://developer.mozilla.org/docs/Web/API/AbortSignal) / [`AbortController`](https://developer.mozilla.org/docs/Web/API/AbortController), enabling you to cancel ongoing asynchronous CSV processing tasks.

This feature is useful for scenarios where processing needs to be halted, such as when a user navigates away from the page or other conditions that require stopping the task early.

#### Example Use Case: Abort with user action

```js
import { parse } from 'web-csv-toolbox';

const controller = new AbortController();
const csv = "name,age\nAlice,30\nBob,25";

try {
  // Parse the CSV data then pass the AbortSignal to the parse function
  for await (const record of parse(csv, { signal: controller.signal })) {
    console.log(record);
  }
} catch (error) {
  if (error instanceof DOMException && error.name === 'AbortError') {
     // The CSV processing was aborted by the user
    console.log('CSV processing was aborted by the user.');
  } else {
    // An error occurred during CSV processing
    console.error('An error occurred:', error);
  }
}

// Some abort logic, like a cancel button
document.getElementById('cancel-button')
  .addEventListener('click', () => {
    controller.abort();
  });
```

#### Example Use Case: Abort with timeout

```js
import { parse } from 'web-csv-toolbox';

// Set up a timeout of 5 seconds (5000 milliseconds)
const signal = AbortSignal.timeout(5000);

const csv = "name,age\nAlice,30\nBob,25";

try {
  // Pass the AbortSignal to the parse function
  const result = await parse.toArray(csv, { signal });
  console.log(result);
} catch (error) {
  if (error instanceof DOMException && error.name === 'TimeoutError') {
    // Handle the case where the processing was aborted due to timeout
    console.log('CSV processing was aborted due to timeout.');
  } else {
    // Handle other errors
    console.error('An error occurred during CSV processing:', error);
  }
}
```

## Supported Runtimes 💻
{% include 'common/supported-runtimes' %}

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
or a [Uint8Array](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Uint8Array) object,
or a [ArrayBuffer](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/ArrayBuffer) object,
or a [Response](https://developer.mozilla.org/docs/Web/API/Response) object.

### Middle-level APIs 🧱

These APIs are optimized for **Enhanced Performance and Control**,
catering to users who need more detailed and fine-tuned functionality.

- **`function parseString(string[, options])`**: [📑](https://kamiazya.github.io/web-csv-toolbox/functions/parseString-1.html)
  - Efficient parsing of CSV strings.
- **`function parseBinary(buffer[, options])`**: [📑](https://kamiazya.github.io/web-csv-toolbox/functions/parseBinary-1.html)
  - Parse CSV Binary of ArrayBuffer or Uint8Array.
- **`function parseResponse(response[, options])`**: [📑](https://kamiazya.github.io/web-csv-toolbox/functions/parseResponse-1.html)
  - Customized parsing directly from `Response` objects.
- **`function parseStream(stream[, options])`**: [📑](https://kamiazya.github.io/web-csv-toolbox/functions/parseStream-1.html)
  - Stream-based parsing for larger or continuous data.
- **`function parseStringStream(stream[, options])`**: [📑](https://kamiazya.github.io/web-csv-toolbox/functions/parseStringStream-1.html)
  - Combines string-based parsing with stream processing.
- **`function parseUint8ArrayStream(stream[, options])`**: [📑](https://kamiazya.github.io/web-csv-toolbox/functions/parseUint8ArrayStream-1.html)
  - Parses binary streams with precise control over data types.

### Low-level APIs ⚙️

These APIs are built for **Advanced Customization and Pipeline Design**,
ideal for developers looking for in-depth control and flexibility.

- **`class LexerTransformer`**: [📑](https://kamiazya.github.io/web-csv-toolbox/classes/LexerTransformer.html)
  - A TransformStream class for lexical analysis of CSV data.
- **`class RecordAssemblerTransformer`**: [📑](https://kamiazya.github.io/web-csv-toolbox/classes/RecordAssemblerTransformer.html)
  - Handles the assembly of parsed data into records.

### Experimental APIs 🧪

These APIs are experimental and may change in the future.

#### Parsing using WebAssembly for high performance.

You can use WebAssembly to parse CSV data for high performance.

- Parsing with WebAssembly is faster than parsing with JavaScript,
but it takes time to load the WebAssembly module.
- Supports only UTF-8 encoding csv data.
- Quotation characters are only `"`. (Double quotation mark)
  - If you pass a different character, it will throw an error.

```ts
import { WASM } from "web-csv-toolbox";

// load WebAssembly module
await WASM.loadWASM();

const csv = "a,b,c\n1,2,3";

// parse CSV string
const result = WASM.parseStringToArraySync(csv);
console.log(result);
// Prints:
// [{ a: "1", b: "2", c: "3" }]
```

- **`function WASM.loadWASM(): Promise<void>`**: [📑](https://kamiazya.github.io/web-csv-toolbox/functions/loadWASM.html)
  - Loads the WebAssembly module.
- **`function WASM.parseStringToArraySync(string[, options]): CSVRecord[]`**: [📑](https://kamiazya.github.io/web-csv-toolbox/functions/parseStringToArraySyncWASM.html)
  - Parses CSV strings into an array of records.

## Options Configuration 🛠️

### Common Options ⚙️

| Option      | Description                           | Default     | Notes                                             |
| ----------- | ------------------------------------- | ----------- | ------------------------------------------------- |
| `delimiter` | Character to separate fields          | `,`         |                                                   |
| `quotation` | Character used for quoting fields     | `"`         |                                                   |
| `headers`   | Custom headers for the parsed records | First row   | If not provided, the first row is used as headers |
| `signal`    | AbortSignal to cancel processing      | `undefined` | Allows aborting of long-running operations        |

### Advanced Options (Binary-Specific) 🧬

| Option          | Description                                       | Default | Notes                                                                                                                                                     |
| --------------- | ------------------------------------------------- | ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `charset`       | Character encoding for binary CSV inputs          | `utf-8` | See [Encoding API Compatibility](https://developer.mozilla.org/en-US/docs/Web/API/Encoding_API/Encodings) for the encoding formats that can be specified. |
| `decompression` | Decompression algorithm for compressed CSV inputs |         | See [DecompressionStream Compatibility](https://developer.mozilla.org/en-US/docs/Web/API/DecompressionStream#browser_compatibilit).                       |
| `ignoreBOM`     | Whether to ignore Byte Order Mark (BOM)           | `false` | See [TextDecoderOptions.ignoreBOM](https://developer.mozilla.org/en-US/docs/Web/API/TextDecoderStream/ignoreBOM) for more information about the BOM.      |
| `fatal`         | Throw an error on invalid characters              | `false` | See [TextDecoderOptions.fatal](https://developer.mozilla.org/en-US/docs/Web/API/TextDecoderStream/fatal) for more information.                            |
{% endblock %}
