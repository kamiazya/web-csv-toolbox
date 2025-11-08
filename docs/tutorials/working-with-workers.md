---
title: Working with Workers
group: Tutorials
---

# Working with Workers

This tutorial will guide you through using web-csv-toolbox's worker thread execution to improve performance and maintain UI responsiveness.

## What you'll learn

By the end of this tutorial, you'll be able to:
- Understand when to use worker threads
- Parse CSV using worker threads
- Use engine presets for common scenarios
- Manage worker pools for concurrent parsing
- Handle errors in worker execution

## Prerequisites

- Completed [Getting Started](./getting-started.md) tutorial
- Node.js LTS or a modern browser
- Basic understanding of async/await and for-await-of loops

## What are Worker Threads?

Worker threads allow you to run CPU-intensive tasks off the main thread, keeping your application responsive. For CSV parsing, this means:

- **In browsers**: Your UI stays responsive while parsing large CSV files
- **In Node.js**: Your server can handle other requests while parsing
- **In both**: You can parse multiple CSV files concurrently

## When to use Workers

**✅ Use workers when:**
- Parsing large CSV files (>1000 rows)
- Maintaining UI responsiveness is critical
- Processing multiple CSV files concurrently
- Working with streaming data

**❌ Skip workers when:**
- Parsing small CSV files (<100 rows)
- Worker initialization overhead outweighs benefits
- Running in environments without worker support

## Step 1: Basic Worker Usage

The simplest way to use workers is with the `engine` option:

```typescript
import { parse } from 'web-csv-toolbox';

const csv = `name,age,city
Alice,30,New York
Bob,25,San Francisco
Charlie,35,Los Angeles`;

// Parse using worker thread
for await (const record of parse(csv, {
  engine: { worker: true }
})) {
  console.log(record);
}
```

**What happens:**
1. CSV data is sent to a worker thread
2. Parsing happens in the worker
3. Results stream back to the main thread
4. Main thread remains responsive

## Step 2: Using Engine Presets

Instead of manually configuring the engine, you can use predefined presets:

```typescript
import { parse, EnginePresets } from 'web-csv-toolbox';

const csv = `name,age,city
Alice,30,New York
Bob,25,San Francisco`;

// Use the 'balanced' preset (recommended for production)
for await (const record of parse(csv, {
  engine: EnginePresets.balanced
})) {
  console.log(record);
}
```

### Available Presets

| Preset | Worker | WASM | Best For |
|--------|--------|------|----------|
| `mainThread` | ❌ | ❌ | Small files, simple use cases |
| `worker` | ✅ | ❌ | Medium files, broad encoding support |
| `workerStreamTransfer` | ✅ | ❌ | Large streaming files (Chrome/Firefox/Edge) |
| `wasm` | ❌ | ✅ | Medium UTF-8 files, main thread |
| `workerWasm` | ✅ | ✅ | Large UTF-8 files |
| `fastest` | ✅ | ✅ | Maximum performance (UTF-8 only) |
| `balanced` | ✅ | ❌ | **Recommended for production** |
| `strict` | ✅ | ❌ | No automatic fallbacks |

**Recommendation:** Use `EnginePresets.balanced()` for most production use cases. It provides good performance while supporting all encodings.

## Step 3: Parsing Network Responses with Workers

Workers are especially useful for parsing CSV from network responses:

```typescript
import { parseResponse, EnginePresets } from 'web-csv-toolbox';

async function fetchAndParseCSV(url: string) {
  const response = await fetch(url);

  // Parse response using worker
  for await (const record of parseResponse(response, {
    engine: EnginePresets.balanced
  })) {
    console.log(record);
  }
}

// Usage
await fetchAndParseCSV('https://example.com/large-data.csv');
```

**Benefits:**
- Network download and parsing happen concurrently
- Main thread stays responsive during both operations
- Automatic handling of Content-Type and Content-Encoding headers

## Step 4: Managing Concurrent Parsing with WorkerPool

When parsing multiple CSV files, use `WorkerPool` to limit resource usage:

```typescript
import { parse, WorkerPool } from 'web-csv-toolbox';

// Create a worker pool with max 4 concurrent workers
using pool = new WorkerPool({ maxWorkers: 4 });

const csvFiles = [
  'data1.csv',
  'data2.csv',
  'data3.csv',
  'data4.csv',
];

// Parse multiple files concurrently
await Promise.all(
  csvFiles.map(async (filename) => {
    const csv = await Deno.readTextFile(filename);

    for await (const record of parse(csv, {
      engine: {
        worker: true,
        workerPool: pool
      }
    })) {
      console.log(`${filename}:`, record);
    }
  })
);

// Pool is automatically disposed when leaving the 'using' block
```

**Key Points:**
- `using` keyword ensures proper cleanup
- Pool limits concurrent workers to `maxWorkers`
- Additional requests wait until a worker becomes available
- Workers are reused for better performance

## Step 5: Error Handling

Always wrap worker parsing in try-catch blocks:

```typescript
import { parse, EnginePresets } from 'web-csv-toolbox';

async function parseWithErrorHandling(csv: string) {
  try {
    for await (const record of parse(csv, {
      engine: EnginePresets.balanced
    })) {
      console.log(record);
    }
  } catch (error) {
    if (error instanceof Error) {
      console.error('Parsing failed:', error.message);
    }
  }
}
```

**Common Errors:**
- **Worker initialization failure**: Worker threads not supported in environment
- **Invalid CSV format**: Malformed CSV data
- **Resource exhaustion**: Too many concurrent workers

## Step 6: Customizing Engine Configuration

You can create custom configurations based on presets:

```typescript
import { parse, EnginePresets } from 'web-csv-toolbox';

// Customize a preset with additional options
for await (const record of parse(csv, {
  engine: EnginePresets.balanced({
    workerPool: myPool,
    onFallback: (info) => console.log('Fallback occurred:', info)
  })
})) {
  console.log(record);
}
```

**Available Preset Options:**
- `workerPool`: Shared WorkerPool instance
- `workerURL`: Custom worker script URL
- `onFallback`: Callback when fallback occurs

## Browser Example: Maintaining UI Responsiveness

```typescript
import { parse, EnginePresets } from 'web-csv-toolbox';

async function handleFileUpload(file: File) {
  const progressElement = document.getElementById('progress');
  const resultsElement = document.getElementById('results');

  progressElement.textContent = 'Parsing...';

  try {
    const csv = await file.text();
    let count = 0;

    // Parse in worker - UI stays responsive
    for await (const record of parse(csv, {
      engine: EnginePresets.balanced
    })) {
      count++;

      // Update UI every 100 records
      if (count % 100 === 0) {
        progressElement.textContent = `Parsed ${count} records...`;
      }

      // Process record
      resultsElement.innerHTML += `<div>${JSON.stringify(record)}</div>`;
    }

    progressElement.textContent = `✓ Parsed ${count} records`;
  } catch (error) {
    progressElement.textContent = '✗ Error parsing CSV';
    console.error(error);
  }
}

// Attach to file input
document.getElementById('csv-file').addEventListener('change', (e) => {
  const file = e.target.files?.[0];
  if (file) handleFileUpload(file);
});
```

## Node.js Example: Server-side CSV Processing

```typescript
import { Hono } from 'hono';
import { parse, WorkerPool } from 'web-csv-toolbox';

const app = new Hono();

// Create shared worker pool
using pool = new WorkerPool({ maxWorkers: 4 });

app.post('/parse-csv', async (c) => {
  const csv = await c.req.text();
  const results = [];

  try {
    for await (const record of parse(csv, {
      engine: {
        worker: true,
        workerPool: pool
      }
    })) {
      results.push(record);
    }

    return c.json({ success: true, data: results });
  } catch (error) {
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

export default app;
```

## Performance Comparison

<!-- TODO: Add actual performance benchmarks based on real measurements -->

**General Guidelines:**
- **Small files (<1000 rows)**: Main thread execution is typically faster due to worker initialization overhead
- **Medium to large files (>1000 rows)**: Worker execution provides performance benefits
- **Large streaming files**: Workers help maintain UI responsiveness

**Note:** Actual performance depends on:
- Hardware specifications
- Runtime environment (Node.js, browser, Deno)
- CSV complexity (number of columns, escaping, etc.)
- Available system resources

For detailed performance benchmarks, see [CodSpeed](https://codspeed.io/kamiazya/web-csv-toolbox).

## Browser Compatibility

Worker support varies by browser:

| Browser | Worker Threads | Stream Transfer | Auto-Fallback |
|---------|---------------|-----------------|---------------|
| Chrome | ✅ | ✅ | N/A |
| Firefox | ✅ | ✅ | N/A |
| Edge | ✅ | ✅ | N/A |
| Safari | ✅ | ❌ | ✅ (to message-streaming) |

**Note:** Safari automatically falls back to message-streaming (slightly slower but still functional).

**Browser API Support:**
- **Web Workers**: [Can I Use](https://caniuse.com/webworkers) | [MDN](https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API)
- **Transferable Streams**: [Can I Use](https://caniuse.com/mdn-api_readablestream_transferable) | [MDN](https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API/Transferable_objects)

For detailed browser compatibility information, see [Supported Environments](../reference/supported-environments.md).

## Summary

You've learned how to:
- ✅ Use worker threads for CSV parsing
- ✅ Choose the right engine preset
- ✅ Manage concurrent parsing with WorkerPool
- ✅ Handle errors in worker execution
- ✅ Maintain UI responsiveness in browsers
- ✅ Process CSV files efficiently on servers

## What's Next?

- **[Secure CSV Processing](../how-to-guides/secure-csv-processing.md)**: Learn about security best practices
- **[API Reference](../reference/api/)**: Explore all available options
- **[Execution Strategies](../explanation/execution-strategies.md)**: Deep dive into how workers work internally

## Troubleshooting

### Worker initialization fails

**Problem:** Error: "Worker threads are not supported"

**Solution:** Ensure you're using a supported environment:
- Node.js LTS
- Modern browser with Web Workers
- Deno LTS

### Performance not improving

**Problem:** Worker execution is slower than main thread

**Solution:**
- Check file size - workers have initialization overhead
- For small files (<1000 rows), use main thread
- Use `EnginePresets.balanced()` instead of manual configuration

### Safari-specific issues

**Problem:** Different behavior in Safari

**Solution:**
- Safari doesn't support Transferable Streams
- Automatic fallback to message-streaming occurs
- Slightly higher memory usage is expected

---

**Need help?** Open an issue on [GitHub](https://github.com/kamiazya/web-csv-toolbox/issues).
