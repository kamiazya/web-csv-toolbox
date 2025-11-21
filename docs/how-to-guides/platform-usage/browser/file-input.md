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

## With Progress Tracking

Display periodic progress updates to improve user experience for large files:

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

    for await (const record of parseFile(file)) {
      // Process record
      console.log(record);
      count++;

      // Update progress every 100 records to avoid too many DOM updates
      if (count % 100 === 0) {
        output.textContent = `Processing... ${count} records`;
      }
    }

    output.textContent = `Completed: ${count} records processed`;
  } catch (error) {
    output.textContent = `Error: ${error.message}`;
  }
});
```

## With Validation

Validate records during parsing and collect errors for user feedback:

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

  // Validate file type
  if (!file.type.includes('csv') && !file.name.endsWith('.csv')) {
    output.textContent = 'Error: Please upload a CSV file';
    return;
  }

  // Validate file size (10MB limit)
  if (file.size > 10 * 1024 * 1024) {
    output.textContent = 'Error: File too large (max 10MB)';
    return;
  }

  try {
    let validCount = 0;
    const errors: string[] = [];

    for await (const record of parseFile(file)) {
      // Field-level validation
      if (!record.email?.includes('@')) {
        errors.push(`Row ${validCount + 1}: Invalid email "${record.email}"`);
      } else if (!record.name || record.name.trim() === '') {
        errors.push(`Row ${validCount + 1}: Name is required`);
      } else {
        validCount++;
      }

      // Limit error collection
      if (errors.length >= 10) {
        break;
      }
    }

    if (errors.length > 0) {
      output.innerHTML = `
        <p><strong>Validation Errors:</strong></p>
        <ul>${errors.map(e => `<li>${e}</li>`).join('')}</ul>
        <p>Valid records: ${validCount}</p>
      `;
    } else {
      output.textContent = `Success: ${validCount} valid records`;
    }
  } catch (error) {
    output.textContent = `Error: ${error.message}`;
  }
});
```

## Batch Processing

Process records in batches for efficient API uploads:

```typescript
import { parseFile } from 'web-csv-toolbox';

const input = document.getElementById('csv-file');
const button = document.getElementById('parse-btn');
const output = document.getElementById('output');

async function sendBatchToAPI(batch: any[]) {
  const response = await fetch('/api/import', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ records: batch })
  });

  if (!response.ok) {
    throw new Error(`API error: ${response.statusText}`);
  }

  return response.json();
}

button.addEventListener('click', async () => {
  const file = input.files[0];
  if (!file) {
    alert('Please select a file');
    return;
  }

  try {
    const BATCH_SIZE = 1000;
    const batch: any[] = [];
    let totalProcessed = 0;

    for await (const record of parseFile(file)) {
      batch.push(record);

      // Send batch when it reaches the batch size
      if (batch.length >= BATCH_SIZE) {
        await sendBatchToAPI(batch);
        totalProcessed += batch.length;
        batch.length = 0; // Clear batch
        output.textContent = `Uploaded ${totalProcessed} records...`;
      }
    }

    // Send remaining records
    if (batch.length > 0) {
      await sendBatchToAPI(batch);
      totalProcessed += batch.length;
    }

    output.textContent = `Success: ${totalProcessed} records uploaded`;
  } catch (error) {
    output.textContent = `Error: ${error.message}`;
  }
});
```

**Batch processing benefits:**
- Reduces number of API requests
- Improves upload performance
- Provides progress feedback
- Handles network errors per batch
