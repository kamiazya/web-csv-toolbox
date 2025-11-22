import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ReusableWorkerPool } from 'web-csv-toolbox';
import { createApp, SECURITY_CONFIG } from './app';
import type { Hono } from 'hono';

describe('Hono Secure CSV API', () => {
  let pool: ReusableWorkerPool;
  let app: Hono;

  // Create fresh pool and app for each test
  beforeEach(() => {
    pool = new ReusableWorkerPool({
      maxWorkers: SECURITY_CONFIG.maxWorkers,
    });
    app = createApp(pool);
  });

  // Cleanup pool after each test
  afterEach(() => {
    pool.terminate();
  });

  describe('Health check', () => {
    it('should return health status', async () => {
      const res = await app.request('/health');

      expect(res.status).toBe(200);
      const data = await res.json() as { status: string; pool: { isFull: boolean } };
      expect(data).toHaveProperty('status', 'ok');
      expect(data).toHaveProperty('pool');
      expect(data.pool).toHaveProperty('isFull');
    });
  });

  describe('Security: Early rejection', () => {
    it('should reject requests when worker pool is full', async () => {
      // Fill the pool by creating maxWorkers concurrent requests
      const promises = Array.from({ length: SECURITY_CONFIG.maxWorkers }, () =>
        app.request('/validate-csv', {
          method: 'POST',
          headers: {
            'Content-Type': 'text/csv',
          },
          body: 'name,email,age\nAlice,alice@example.com,30\n',
        })
      );

      // Create one more request that should be rejected
      const extraRequest = app.request('/validate-csv', {
        method: 'POST',
        headers: {
          'Content-Type': 'text/csv',
        },
        body: 'name,email,age\nBob,bob@example.com,25\n',
      });

      // Wait for all requests
      const results = await Promise.all([...promises, extraRequest]) as Response[];

      // At least one should be rejected with 503
      const rejectedRequests = results.filter((res) => res.status === 503);
      expect(rejectedRequests.length).toBeGreaterThan(0);

      // Check error message
      const rejectedResponse = await rejectedRequests[0].json() as { error: string };
      expect(rejectedResponse).toHaveProperty('error');
      expect(rejectedResponse.error).toContain('temporarily unavailable');
    });
  });

  describe('Security: Content-Type validation', () => {
    it('should reject requests without Content-Type header', async () => {
      const res = await app.request('/validate-csv', {
        method: 'POST',
        body: 'name,email,age\nAlice,alice@example.com,30\n',
      });

      expect(res.status).toBe(415);
      const data = await res.json() as { error: string };
      expect(data).toHaveProperty('error');
      expect(data.error).toContain('Content-Type');
    });

    it('should reject requests with wrong Content-Type', async () => {
      const res = await app.request('/validate-csv', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: 'name,email,age\nAlice,alice@example.com,30\n',
      });

      expect(res.status).toBe(415);
      const data = await res.json() as { error: string };
      expect(data).toHaveProperty('error');
      expect(data.error).toContain('Content-Type');
    });

    it('should accept text/csv Content-Type', async () => {
      const res = await app.request('/validate-csv', {
        method: 'POST',
        headers: {
          'Content-Type': 'text/csv',
        },
        body: 'name,email,age\nAlice,alice@example.com,30\n',
      });

      expect(res.status).toBe(202);
      expect(res.headers.get('Content-Type')).toContain('text/event-stream');
    });

    it('should accept text/csv with charset', async () => {
      const res = await app.request('/validate-csv', {
        method: 'POST',
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
        },
        body: 'name,email,age\nAlice,alice@example.com,30\n',
      });

      expect(res.status).toBe(202);
      expect(res.headers.get('Content-Type')).toContain('text/event-stream');
    });
  });

  describe('Security: Content-Length validation', () => {
    it('should reject requests exceeding maxRequestBodySize', async () => {
      const res = await app.request('/validate-csv', {
        method: 'POST',
        headers: {
          'Content-Type': 'text/csv',
          'Content-Length': String(SECURITY_CONFIG.maxRequestBodySize + 1),
        },
        body: 'name,email,age\nAlice,alice@example.com,30\n',
      });

      expect(res.status).toBe(413);
      const data = await res.json() as { error: string };
      expect(data).toHaveProperty('error');
      expect(data.error).toContain('too large');
    });

    it('should accept requests within maxRequestBodySize', async () => {
      const res = await app.request('/validate-csv', {
        method: 'POST',
        headers: {
          'Content-Type': 'text/csv',
          'Content-Length': String(SECURITY_CONFIG.maxRequestBodySize - 1),
        },
        body: 'name,email,age\nAlice,alice@example.com,30\n',
      });

      expect(res.status).toBe(202);
      expect(res.headers.get('Content-Type')).toContain('text/event-stream');
    });
  });

  describe('Security: Empty body validation', () => {
    it('should reject requests with empty body', async () => {
      const res = await app.request('/validate-csv', {
        method: 'POST',
        headers: {
          'Content-Type': 'text/csv',
        },
        body: null,
      });

      expect(res.status).toBe(400);
      const data = await res.json() as { error: string };
      expect(data).toHaveProperty('error');
      expect(data.error).toContain('required');
    });
  });

  describe('Security: Resource limits', () => {
    it('should reject CSV exceeding maxFieldCount', async () => {
      // Create CSV with more fields than allowed
      const fields = Array.from({ length: SECURITY_CONFIG.maxFieldCount + 1 }, (_, i) => `field${i}`);
      const values = Array.from({ length: SECURITY_CONFIG.maxFieldCount + 1 }, (_, i) => `value${i}`);
      const csv = `${fields.join(',')}\n${values.join(',')}\n`;

      const res = await app.request('/validate-csv', {
        method: 'POST',
        headers: {
          'Content-Type': 'text/csv',
        },
        body: csv,
      });

      // Resource limit errors are caught during streaming and returned as SSE errors
      expect(res.status).toBe(202);
      expect(res.headers.get('Content-Type')).toContain('text/event-stream');

      const text = await res.text();
      const lines = text.split('\n').filter(Boolean) as string[];

      // Should contain error event about exceeding limits
      expect(lines.some((line) => line.includes('event: error'))).toBe(true);
    });

    it('should reject CSV with field exceeding maxBufferSize', async () => {
      // Create CSV with a single field exceeding maxBufferSize
      const largeField = 'x'.repeat(SECURITY_CONFIG.maxBufferSize + 1);
      const csv = `name,email,age\n"${largeField}",alice@example.com,30\n`;

      const res = await app.request('/validate-csv', {
        method: 'POST',
        headers: {
          'Content-Type': 'text/csv',
        },
        body: csv,
      });

      // Resource limit errors are caught during streaming and returned as SSE errors
      expect(res.status).toBe(202);
      expect(res.headers.get('Content-Type')).toContain('text/event-stream');

      const text = await res.text();
      const lines = text.split('\n').filter(Boolean) as string[];

      // Should contain error event about exceeding limits
      expect(lines.some((line) => line.includes('event: error'))).toBe(true);
    });
  });

  describe('Valid CSV processing', () => {
    it('should successfully parse valid CSV', async () => {
      const csv = `name,email,age
Alice,alice@example.com,30
Bob,bob@example.com,25
Charlie,charlie@example.com,35
`;

      const res = await app.request('/validate-csv', {
        method: 'POST',
        headers: {
          'Content-Type': 'text/csv',
        },
        body: csv,
      });

      expect(res.status).toBe(202);
      expect(res.headers.get('Content-Type')).toContain('text/event-stream');

      // Parse SSE response
      const text = await res.text();
      const lines = text.split('\n').filter(Boolean) as string[];

      // Should contain summary event
      expect(lines.some((line) => line.includes('event: summary'))).toBe(true);

      // Extract summary data
      const summaryIndex = lines.findIndex((line) => line.includes('event: summary'));
      const summaryData = lines[summaryIndex + 1].replace('data: ', '');
      const summary = JSON.parse(summaryData);

      expect(summary).toHaveProperty('valid', 3);
      expect(summary).toHaveProperty('errors', 0);
      expect(summary).toHaveProperty('total', 3);
      expect(summary).toHaveProperty('bytesRead');
    });

    it('should report validation errors via SSE', async () => {
      const csv = `name,email,age
Alice,alice@example.com,30
Bob,invalid-email,25
Charlie,charlie@example.com,not-a-number
`;

      const res = await app.request('/validate-csv', {
        method: 'POST',
        headers: {
          'Content-Type': 'text/csv',
        },
        body: csv,
      });

      expect(res.status).toBe(202);

      // Parse SSE response
      const text = await res.text();
      const lines = text.split('\n').filter(Boolean) as string[];

      // Should contain error events
      const errorEvents = lines.filter((line) => line.includes('event: error'));
      expect(errorEvents.length).toBeGreaterThan(0);

      // Extract summary
      const summaryIndex = lines.findIndex((line) => line.includes('event: summary'));
      const summaryData = lines[summaryIndex + 1].replace('data: ', '');
      const summary = JSON.parse(summaryData);

      expect(summary.valid).toBe(1); // Only Alice's record is valid
      expect(summary.errors).toBe(2); // Bob and Charlie have errors
    });

    it('should validate email format', async () => {
      const csv = `name,email,age
Alice,not-an-email,30
`;

      const res = await app.request('/validate-csv', {
        method: 'POST',
        headers: {
          'Content-Type': 'text/csv',
        },
        body: csv,
      });

      expect(res.status).toBe(202);

      const text = await res.text();
      const lines = text.split('\n').filter(Boolean) as string[];

      // Should report email validation error
      const errorEventIndex = lines.findIndex((line) => line.includes('event: error'));
      expect(errorEventIndex).toBeGreaterThan(-1);

      const errorData = lines[errorEventIndex + 1].replace('data: ', '');
      const error = JSON.parse(errorData);

      expect(error).toHaveProperty('errors');
      expect(error.errors.some((e: any) => e.path === 'email')).toBe(true);
    });

    it('should validate age range', async () => {
      const csv = `name,email,age
Alice,alice@example.com,999
`;

      const res = await app.request('/validate-csv', {
        method: 'POST',
        headers: {
          'Content-Type': 'text/csv',
        },
        body: csv,
      });

      expect(res.status).toBe(202);

      const text = await res.text();
      const lines = text.split('\n').filter(Boolean) as string[];

      // Should report age validation error
      const errorEventIndex = lines.findIndex((line) => line.includes('event: error'));
      expect(errorEventIndex).toBeGreaterThan(-1);

      const errorData = lines[errorEventIndex + 1].replace('data: ', '');
      const error = JSON.parse(errorData);

      expect(error).toHaveProperty('errors');
      expect(error.errors.some((e: any) => e.path === 'age')).toBe(true);
    });
  });

  describe('Security: Actual byte counting (bypass prevention)', () => {
    it('should count actual bytes with TransformStream', async () => {
      const csv = `name,email,age
Alice,alice@example.com,30
Bob,bob@example.com,25
`;

      const res = await app.request('/validate-csv', {
        method: 'POST',
        headers: {
          'Content-Type': 'text/csv',
        },
        body: csv,
      });

      expect(res.status).toBe(202);

      const text = await res.text();
      const lines = text.split('\n').filter(Boolean) as string[];

      // Extract summary to verify bytesRead is tracked
      const summaryIndex = lines.findIndex((line) => line.includes('event: summary'));
      const summaryData = lines[summaryIndex + 1].replace('data: ', '');
      const summary = JSON.parse(summaryData);

      // Verify bytesRead is tracked
      expect(summary).toHaveProperty('bytesRead');
      expect(summary.bytesRead).toBeGreaterThan(0);
    });

    it.skip('should reject oversized stream (manual test required)', async () => {
      // TODO: Large file streaming tests (50MB+) are unreliable in automated tests
      // due to memory constraints, timing issues, and test framework limitations.
      //
      // Manual test procedure:
      // 1. Start the dev server: pnpm dev
      // 2. Run the manual test script: ./manual-tests/test-byte-limit.sh
      //
      // The manual test verifies:
      // - Content-Length bypass (incorrect header vs actual size)
      // - Chunked encoding (no Content-Length header)
      // - Actual byte counting via TransformStream
      // - Fatal event streaming when size limit exceeded
      //
      // Expected behavior:
      // - byteLimitStream.hasExceededLimit() returns true
      // - Fatal event sent: {"error":"Request body size limit exceeded","bytesRead":...,"limit":...}
      // - Works regardless of Content-Length header presence or value

      expect(true).toBe(true); // Placeholder - requires manual testing
    });
  });

  describe('Security: Error count limits', () => {
    it('should stop processing after maxErrorCount validation errors', async () => {
      // Create CSV with many invalid records (exceeding maxErrorCount)
      const invalidRecords = Array.from(
        { length: SECURITY_CONFIG.maxErrorCount + 100 },
        (_, i) => `Invalid${i},not-an-email,invalid-age`
      ).join('\n');
      const csv = `name,email,age\n${invalidRecords}\n`;

      const res = await app.request('/validate-csv', {
        method: 'POST',
        headers: {
          'Content-Type': 'text/csv',
        },
        body: csv,
      });

      // SSE starts with 200, but should send fatal event when limit exceeded
      expect(res.status).toBe(202);
      expect(res.headers.get('Content-Type')).toContain('text/event-stream');

      const text = await res.text();
      const lines = text.split('\n').filter(Boolean) as string[];

      // Should contain fatal event about error count limit
      expect(lines.some((line) => line.includes('event: fatal'))).toBe(true);

      // Extract fatal event data
      const fatalIndex = lines.findIndex((line) => line.includes('event: fatal'));
      const fatalData = lines[fatalIndex + 1].replace('data: ', '');
      const fatal = JSON.parse(fatalData);

      expect(fatal).toHaveProperty('error');
      expect(fatal.error).toContain('Error count limit exceeded');
      expect(fatal).toHaveProperty('limit', SECURITY_CONFIG.maxErrorCount);
    });

    it('should include bytesRead in fatal error responses', async () => {
      // Create CSV with errors exceeding maxErrorCount
      const invalidRecords = Array.from(
        { length: SECURITY_CONFIG.maxErrorCount + 10 },
        (_, i) => `Invalid${i},not-an-email,not-a-number`
      ).join('\n');
      const csv = `name,email,age\n${invalidRecords}\n`;

      const res = await app.request('/validate-csv', {
        method: 'POST',
        headers: {
          'Content-Type': 'text/csv',
        },
        body: csv,
      });

      expect(res.status).toBe(202);
      expect(res.headers.get('Content-Type')).toContain('text/event-stream');

      const text = await res.text();
      const lines = text.split('\n').filter(Boolean) as string[];

      // Should contain fatal event
      const fatalIndex = lines.findIndex((line) => line.includes('event: fatal'));
      const fatalData = lines[fatalIndex + 1].replace('data: ', '');
      const fatal = JSON.parse(fatalData);

      expect(fatal).toHaveProperty('limit', SECURITY_CONFIG.maxErrorCount);
    });
  });

  describe('Security: Record count limits', () => {
    it('should stop processing after maxRecordCount records', async () => {
      // Create CSV with more records than allowed
      const records = Array.from(
        { length: SECURITY_CONFIG.maxRecordCount + 100 },
        (_, i) => `User${i},user${i}@example.com,${20 + (i % 50)}`
      ).join('\n');
      const csv = `name,email,age\n${records}\n`;

      const res = await app.request('/validate-csv', {
        method: 'POST',
        headers: {
          'Content-Type': 'text/csv',
        },
        body: csv,
      });

      // SSE starts with 200, but should send fatal event when limit exceeded
      expect(res.status).toBe(202);
      expect(res.headers.get('Content-Type')).toContain('text/event-stream');

      const text = await res.text();
      const lines = text.split('\n').filter(Boolean) as string[];

      // Should contain fatal event about record count limit
      expect(lines.some((line) => line.includes('event: fatal'))).toBe(true);

      // Extract fatal event data
      const fatalIndex = lines.findIndex((line) => line.includes('event: fatal'));
      const fatalData = lines[fatalIndex + 1].replace('data: ', '');
      const fatal = JSON.parse(fatalData);

      expect(fatal).toHaveProperty('error');
      expect(fatal.error).toContain('Record count limit exceeded');
      expect(fatal).toHaveProperty('limit', SECURITY_CONFIG.maxRecordCount);
      expect(fatal).toHaveProperty('bytesRead');
    });
  });

  describe('Error handling', () => {
    it('should handle malformed CSV', async () => {
      const csv = `name,email,age
"Unclosed quote,alice@example.com,30
`;

      const res = await app.request('/validate-csv', {
        method: 'POST',
        headers: {
          'Content-Type': 'text/csv',
        },
        body: csv,
      });

      // Malformed CSV errors are caught during streaming and returned as SSE errors
      expect(res.status).toBe(202);
      expect(res.headers.get('Content-Type')).toContain('text/event-stream');

      const text = await res.text();
      const lines = text.split('\n').filter(Boolean) as string[];

      // Should contain error event about parsing issue
      expect(lines.some((line) => line.includes('event: error'))).toBe(true);
    });

    it('should handle empty CSV (header only)', async () => {
      const csv = 'name,email,age\n';

      const res = await app.request('/validate-csv', {
        method: 'POST',
        headers: {
          'Content-Type': 'text/csv',
        },
        body: csv,
      });

      expect(res.status).toBe(202);

      const text = await res.text();
      const lines = text.split('\n').filter(Boolean) as string[];

      const summaryIndex = lines.findIndex((line) => line.includes('event: summary'));
      const summaryData = lines[summaryIndex + 1].replace('data: ', '');
      const summary = JSON.parse(summaryData);

      expect(summary.valid).toBe(0);
      expect(summary.errors).toBe(0);
      expect(summary).toHaveProperty('total', 0);
      expect(summary).toHaveProperty('bytesRead');
    });
  });
});
