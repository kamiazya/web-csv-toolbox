---
title: Browser - File Input
group: Platform Usage
---

# File Input Elements

Parse CSV files selected by users through file input elements.

**HTML:**
```html
<input type="file" id="csv-file" accept=".csv,.csv.gz">
<button id="parse-btn">Parse CSV</button>
<div id="output"></div>
```

**JavaScript:**
```typescript
import { parseFile } from 'web-csv-toolbox';

const input = document.getElementById('csv-file');
const button = document.getElementById('parse-btn');
const output = document.getElementById('output');

button.addEventListener('click', async () => {
  const file = input.files[0];
  if (!file) {
    alert('Please select a file');
    return;
  }

  try {
    let count = 0;

    // Detect compression from file extension
    const options = file.name.endsWith('.gz')
      ? { decompression: 'gzip' as CompressionFormat }
      : {};

    for await (const record of parseFile(file, options)) {
      // Process record (e.g., display in table, send to server, etc.)
      console.log(record);
      count++;
    }

    output.textContent = `Parsed ${count} records`;
  } catch (error) {
    output.textContent = `Error: ${error.message}`;
  }
});
```
