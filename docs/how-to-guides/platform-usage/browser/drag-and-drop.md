---
title: Browser - Drag and Drop
group: Platform Usage
---

# Drag and Drop

Handle CSV files dropped onto a designated area.

**HTML:**
```html
<div id="drop-zone" style="
  border: 2px dashed #ccc;
  border-radius: 8px;
  padding: 40px;
  text-align: center;
  cursor: pointer;
">
  Drop CSV file here or click to select
</div>
<div id="status"></div>
```

**JavaScript:**
```typescript
import { parseFile } from 'web-csv-toolbox';

const dropZone = document.getElementById('drop-zone');
const status = document.getElementById('status');

// Shared file processing logic
async function processFile(file: File) {
  // Validate file type
  if (!file.type.includes('csv') && !file.name.endsWith('.csv')) {
    status.textContent = 'Please select a CSV file';
    return;
  }

  status.textContent = 'Processing...';

  try {
    let count = 0;
    for await (const record of parseFile(file)) {
      // Process record (e.g., display in table, send to server, etc.)
      console.log(record);
      count++;
    }

    status.textContent = `✓ Parsed ${count} records`;
  } catch (error) {
    status.textContent = `✗ Error: ${error.message}`;
  }
}

// Handle drag over
dropZone.addEventListener('dragover', (e) => {
  e.preventDefault();
  dropZone.style.borderColor = '#4CAF50';
});

dropZone.addEventListener('dragleave', () => {
  dropZone.style.borderColor = '#ccc';
});

// Handle drop
dropZone.addEventListener('drop', async (e) => {
  e.preventDefault();
  dropZone.style.borderColor = '#ccc';

  const file = e.dataTransfer.files[0];
  if (file) {
    await processFile(file);
  }
});

// Also support click to select
dropZone.addEventListener('click', () => {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.csv';
  input.onchange = async (e) => {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (file) {
      await processFile(file);
    }
  };
  input.click();
});
```
