# FormData

Parse CSV files submitted through forms.

**HTML:**
```html
<form id="upload-form">
  <input type="file" name="csvfile" accept=".csv" required>
  <input type="text" name="username" placeholder="Your name" required>
  <button type="submit">Upload</button>
</form>
<div id="form-status"></div>
```

**JavaScript:**
```typescript
import { parseFile } from 'web-csv-toolbox';

const form = document.getElementById('upload-form');
const formStatus = document.getElementById('form-status');

form.addEventListener('submit', async (e) => {
  e.preventDefault();

  const formData = new FormData(e.target as HTMLFormElement);

  // Get the file from FormData
  const file = formData.get('csvfile') as File;
  const username = formData.get('username') as string;

  if (!file) {
    formStatus.textContent = 'No file selected';
    return;
  }

  formStatus.textContent = 'Processing...';

  try {
    // Validate the CSV file
    let count = 0;
    for await (const record of parseFile(file)) {
      // Validate record (e.g., check required fields)
      count++;
    }

    // Send file to server for processing
    const uploadFormData = new FormData();
    uploadFormData.append('csvfile', file);
    uploadFormData.append('username', username);

    const response = await fetch('/api/upload', {
      method: 'POST',
      body: uploadFormData
    });

    if (response.ok) {
      formStatus.textContent = `✓ Validated ${count} records and uploaded`;
    } else {
      formStatus.textContent = '✗ Upload failed';
    }
  } catch (error) {
    formStatus.textContent = `✗ Error: ${error.message}`;
  }
});
```

**Alternative: Direct FormData submission with server-side parsing**

```typescript
// Client-side: Send FormData directly
form.addEventListener('submit', async (e) => {
  e.preventDefault();

  const formData = new FormData(e.target as HTMLFormElement);

  await fetch('/api/upload', {
    method: 'POST',
    body: formData // Send FormData directly
  });
});

// Server-side (Cloudflare Workers example)
import { parseFile } from 'web-csv-toolbox';

export default {
  async fetch(request: Request) {
    const formData = await request.formData();
    const file = formData.get('csvfile') as File;

    // Parse CSV on server
    let count = 0;
    for await (const record of parseFile(file)) {
      // Process record (e.g., save to database, validate, etc.)
      count++;
    }

    return Response.json({ success: true, count });
  }
};
```
