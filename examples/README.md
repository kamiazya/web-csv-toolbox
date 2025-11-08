# Examples

This directory contains example demonstrations of the web-csv-toolbox library.

## Non-blocking WASM CSV Parser Demo

**File:** `non-blocking-demo.html`

This demo demonstrates the key benefit of using Web Workers with WASM for CSV parsing: maintaining UI responsiveness during heavy CSV processing.

### What it demonstrates:

1. **Blocking (Main Thread) Parsing** - When parsing CSV on the main thread, the UI freezes (the animated counter stops)
2. **Non-blocking (Worker + WASM) Parsing** - When parsing CSV in a Web Worker with WASM, the UI remains responsive (the counter keeps animating)

### How to run:

1. Build the project:
   ```bash
   npm run build
   ```

2. Start a local web server from the project root directory:
   ```bash
   # Using Python 3
   python3 -m http.server 8000

   # Or using Node.js http-server
   npx http-server -p 8000

   # Or using PHP
   php -S localhost:8000
   ```

3. Open your browser and navigate to:
   ```
   http://localhost:8000/examples/non-blocking-demo.html
   ```

4. Try both buttons and watch the counter:
   - With "Parse on Main Thread" - the counter will freeze
   - With "Parse in Worker with WASM" - the counter keeps animating

### Why this matters:

In real applications, parsing large CSV files on the main thread can make your UI completely unresponsive. Users might see:
- Frozen animations
- Unresponsive buttons
- Browser "page unresponsive" warnings

By using Web Workers with WASM, your application can:
- Parse large CSV files without blocking the UI
- Maintain smooth animations and interactions
- Provide a better user experience
- Prevent browser warnings about unresponsive scripts

### Configuration:

You can adjust the number of rows to generate using the input field. The default is 100,000 rows, which should be enough to demonstrate the blocking behavior on most systems.

For slower systems, try fewer rows (e.g., 50,000). For faster systems, try more rows (e.g., 200,000 or more).
