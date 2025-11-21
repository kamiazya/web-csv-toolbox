#!/usr/bin/env tsx
/**
 * Manual test for byte counting security
 *
 * This test verifies that the server correctly counts actual bytes received
 * and rejects requests that exceed maxRequestBodySize, regardless of Content-Length header.
 *
 * Usage: pnpm test:manual
 */

import { SECURITY_CONFIG } from '../src/app.ts';

const SERVER_URL = 'http://localhost:3000';
const MAX_REQUEST_BODY_SIZE = SECURITY_CONFIG.maxRequestBodySize;
const TARGET_SIZE = MAX_REQUEST_BODY_SIZE + 100 * 1024; // 50MB + 100KB

console.log('======================================');
console.log('Byte Counting Security Manual Test');
console.log('======================================');
console.log('');

// Check if server is running
try {
  const healthResponse = await fetch(`${SERVER_URL}/health`);
  if (!healthResponse.ok) {
    throw new Error(`Health check failed: ${healthResponse.status}`);
  }
  console.log('✓ Server is running');
  console.log('');
} catch (error) {
  console.error('❌ Error: Server is not running');
  console.error('Please start the server with: pnpm dev');
  process.exit(1);
}

/**
 * Creates a readable stream that generates CSV data
 * @param {number} targetSize - Target size in bytes
 * @returns {ReadableStream}
 */
function createLargeCSVStream(targetSize) {
  let bytesSent = 0;
  const encoder = new TextEncoder();

  return new ReadableStream({
    start(controller) {
      // Send header
      const header = 'name,email,age\n';
      const headerBytes = encoder.encode(header);
      controller.enqueue(headerBytes);
      bytesSent += headerBytes.byteLength;

      // Send records in chunks
      let recordNum = 0;
      const sendChunk = () => {
        // Create a chunk of records (1000 records at a time)
        const chunk = [];
        for (let i = 0; i < 1000 && bytesSent < targetSize; i++) {
          const record = `User${recordNum},user${recordNum}@example.com,${20 + (recordNum % 50)}\n`;
          chunk.push(record);
          bytesSent += record.length;
          recordNum++;
        }

        if (chunk.length > 0) {
          const chunkBytes = encoder.encode(chunk.join(''));
          controller.enqueue(chunkBytes);
        }

        if (bytesSent >= targetSize) {
          controller.close();
        } else {
          // Continue sending in next tick to avoid blocking
          setImmediate(sendChunk);
        }
      };

      sendChunk();
    }
  });
}

/**
 * Test helper function
 */
async function runTest(testName, testFn) {
  console.log(testName);
  console.log('-'.repeat(testName.length));

  try {
    const result = await testFn();

    if (result.passed) {
      console.log(`✓ ${testName} PASSED`);
      console.log('');
      if (result.details) {
        console.log('Event details:');
        console.log(JSON.stringify(result.details, null, 2));
        console.log('');
      }
    } else {
      console.log(`❌ ${testName} FAILED`);
      console.log('');
      if (result.error) {
        console.log('Error:', result.error);
        console.log('');
      }
      if (result.response) {
        console.log('Response (first 500 chars):');
        console.log(result.response.substring(0, 500));
        console.log('');
      }
    }

    return result.passed;
  } catch (error) {
    console.log(`❌ ${testName} ERROR`);
    console.log('');
    console.error('Error:', error.message);
    console.log('');
    return false;
  }
}

// Test 1: Content-Length bypass attack
const test1Passed = await runTest(
  'Test 1: Content-Length Bypass Attack',
  async () => {
    console.log('Sending large CSV with incorrect Content-Length header...');
    console.log(`Target size: ${(TARGET_SIZE / 1024 / 1024).toFixed(2)}MB`);
    console.log('Content-Length header: 100 bytes (intentionally incorrect)');
    console.log('');

    const stream = createLargeCSVStream(TARGET_SIZE);

    const response = await fetch(`${SERVER_URL}/validate-csv`, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/csv',
        'Content-Length': '100', // Intentionally incorrect
      },
      body: stream,
      duplex: 'half',
    });

    if (response.status !== 202) {
      return {
        passed: false,
        error: `Expected status 202, got ${response.status}`,
      };
    }

    const text = await response.text();
    const lines = text.split('\n').filter(Boolean);

    // Check for fatal event
    const hasFatalEvent = lines.some(line => line.includes('event: fatal'));

    if (!hasFatalEvent) {
      return {
        passed: false,
        error: 'No fatal event detected',
        response: text,
      };
    }

    // Parse fatal event data
    const fatalIndex = lines.findIndex(line => line.includes('event: fatal'));
    const dataLine = lines[fatalIndex + 1];
    const fatalData = JSON.parse(dataLine.replace(/^data: /, ''));

    // Verify bytesRead exceeds limit
    if (fatalData.bytesRead <= MAX_REQUEST_BODY_SIZE) {
      return {
        passed: false,
        error: `bytesRead (${fatalData.bytesRead}) should exceed ${MAX_REQUEST_BODY_SIZE}`,
        details: fatalData,
      };
    }

    return {
      passed: true,
      details: fatalData,
    };
  }
);

// Test 2: Chunked encoding without Content-Length
const test2Passed = await runTest(
  'Test 2: Chunked Encoding (No Content-Length)',
  async () => {
    console.log('Sending large CSV without Content-Length header...');
    console.log(`Target size: ${(TARGET_SIZE / 1024 / 1024).toFixed(2)}MB`);
    console.log('Content-Length header: (omitted)');
    console.log('');

    const stream = createLargeCSVStream(TARGET_SIZE);

    const response = await fetch(`${SERVER_URL}/validate-csv`, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/csv',
        // No Content-Length header
      },
      body: stream,
      duplex: 'half',
    });

    if (response.status !== 202) {
      return {
        passed: false,
        error: `Expected status 202, got ${response.status}`,
      };
    }

    const text = await response.text();
    const lines = text.split('\n').filter(Boolean);

    // Check for fatal event
    const hasFatalEvent = lines.some(line => line.includes('event: fatal'));

    if (!hasFatalEvent) {
      return {
        passed: false,
        error: 'No fatal event detected',
        response: text,
      };
    }

    // Parse fatal event data
    const fatalIndex = lines.findIndex(line => line.includes('event: fatal'));
    const dataLine = lines[fatalIndex + 1];
    const fatalData = JSON.parse(dataLine.replace(/^data: /, ''));

    // Verify bytesRead exceeds limit
    if (fatalData.bytesRead <= MAX_REQUEST_BODY_SIZE) {
      return {
        passed: false,
        error: `bytesRead (${fatalData.bytesRead}) should exceed ${MAX_REQUEST_BODY_SIZE}`,
        details: fatalData,
      };
    }

    return {
      passed: true,
      details: fatalData,
    };
  }
);

// Test 3: Valid request within limits
const test3Passed = await runTest(
  'Test 3: Valid Request Within Limits',
  async () => {
    console.log('Sending small valid CSV...');
    console.log('');

    const csv = 'name,email,age\nAlice,alice@example.com,30\nBob,bob@example.com,25\n';

    const response = await fetch(`${SERVER_URL}/validate-csv`, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/csv',
      },
      body: csv,
    });

    if (response.status !== 202) {
      return {
        passed: false,
        error: `Expected status 202, got ${response.status}`,
      };
    }

    const text = await response.text();
    const lines = text.split('\n').filter(Boolean);

    // Check for summary event
    const hasSummaryEvent = lines.some(line => line.includes('event: summary'));

    if (!hasSummaryEvent) {
      return {
        passed: false,
        error: 'No summary event detected',
        response: text,
      };
    }

    // Parse summary event data
    const summaryIndex = lines.findIndex(line => line.includes('event: summary'));
    const dataLine = lines[summaryIndex + 1];
    const summaryData = JSON.parse(dataLine.replace(/^data: /, ''));

    // Verify summary data
    if (summaryData.valid !== 2 || summaryData.errors !== 0) {
      return {
        passed: false,
        error: `Expected 2 valid records, 0 errors. Got: ${JSON.stringify(summaryData)}`,
      };
    }

    return {
      passed: true,
      details: summaryData,
    };
  }
);

// Summary
console.log('======================================');
console.log('Test Summary');
console.log('======================================');
console.log('');
console.log(`Test 1 (Content-Length Bypass): ${test1Passed ? '✓ PASSED' : '❌ FAILED'}`);
console.log(`Test 2 (Chunked Encoding):      ${test2Passed ? '✓ PASSED' : '❌ FAILED'}`);
console.log(`Test 3 (Valid Request):         ${test3Passed ? '✓ PASSED' : '❌ FAILED'}`);
console.log('');

const allPassed = test1Passed && test2Passed && test3Passed;

if (allPassed) {
  console.log('✓ All tests passed!');
  console.log('');
  console.log('Key verification points:');
  console.log('1. ✓ Fatal events include bytesRead field');
  console.log('2. ✓ bytesRead exceeds 50MB (maxRequestBodySize)');
  console.log('3. ✓ Server terminates stream when limit exceeded');
  console.log('4. ✓ Works regardless of Content-Length header');
  process.exit(0);
} else {
  console.log('❌ Some tests failed. Please review the output above.');
  process.exit(1);
}
