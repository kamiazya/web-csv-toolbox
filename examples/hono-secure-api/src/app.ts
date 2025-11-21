import { Hono, type Context } from 'hono';
import { stream } from 'hono/streaming';
import { z } from 'zod';
import {
  type ReusableWorkerPool,
  EnginePresets,
  parseUint8ArrayStream,
  ParseError,
} from 'web-csv-toolbox';

export const SECURITY_CONFIG = {
  maxRequestBodySize: 50 * 1024 * 1024, // 50MB
  maxWorkers: 4,
  parseTimeout: 30000, // 30 seconds
  maxBufferSize: 5 * 1024 * 1024, // 5MB
  maxFieldCount: 10000, // 10k fields/record
  maxRecordCount: 100000, // 100k records max
  maxErrorCount: 1000, // Stop after 1000 validation errors
} as const;

const recordSchema = z.object({
  name: z.string().min(1).max(100),
  email: z.email(),
  age: z.coerce.number().int().min(0).max(150),
});

/**
 * Creates a TransformStream that counts actual bytes received and enforces size limits.
 * This prevents attackers from bypassing Content-Length header checks with chunked encoding
 * or by sending more data than declared.
 */
function createByteLimitStream(maxBytes: number): {
  stream: TransformStream<Uint8Array, Uint8Array>;
  getBytesRead: () => number;
  hasExceededLimit: () => boolean;
} {
  let bytesRead = 0;
  let exceededLimit = false;

  const stream = new TransformStream<Uint8Array, Uint8Array>({
    transform(chunk, controller) {
      bytesRead += chunk.byteLength;

      if (bytesRead > maxBytes) {
        exceededLimit = true;
        controller.error(
          new RangeError(`Request body size ${bytesRead} exceeds limit of ${maxBytes} bytes`)
        );
        return;
      }

      controller.enqueue(chunk);
    },
  });

  return {
    stream,
    getBytesRead: () => bytesRead,
    hasExceededLimit: () => exceededLimit,
  };
}

export function createApp(pool: ReusableWorkerPool) {
  const app = new Hono();

  // Health check endpoint
  app.get('/health', (c: Context) => {
    return c.json({
      status: 'ok',
      pool: {
        isFull: pool.isFull(),
      },
    });
  });

  // Secure CSV validation endpoint with SSE
  app.post('/validate-csv', async (c: Context) => {
    // 1. Early rejection if pool is saturated
    if (pool.isFull()) {
      console.warn('WorkerPool saturated - rejecting request');
      return c.json({ error: 'Service temporarily unavailable. Please try again later.' }, 503);
    }

    // 2. Verify Content-Type
    const contentType = c.req.header('Content-Type');
    if (!contentType?.startsWith('text/csv')) {
      return c.json({ error: 'Content-Type must be text/csv' }, 415);
    }

    // 3. Check Content-Length (early rejection only - actual bytes will be counted)
    const contentLength = c.req.header('Content-Length');
    if (contentLength && Number.parseInt(contentLength) > SECURITY_CONFIG.maxRequestBodySize) {
      return c.json({ error: 'Request body too large' }, 413);
    }

    // 4. Validate body exists
    const rawBody = c.req.raw.body;
    if (!rawBody) {
      return c.json({ error: 'Request body is required' }, 400);
    }

    // 5. Create byte-counting stream to track actual received bytes
    // This prevents attackers from bypassing Content-Length checks with chunked encoding
    const byteLimitStream = createByteLimitStream(SECURITY_CONFIG.maxRequestBodySize);
    const csvStream = rawBody.pipeThrough(byteLimitStream.stream);

    // 6. Timeout protection
    const signal = AbortSignal.timeout(SECURITY_CONFIG.parseTimeout);

    try {
      return stream(c, async (stream) => {
        c.status(202); // Accepted - processing in progress
        c.header('Content-Type', 'text/event-stream');
        c.header('Cache-Control', 'no-cache');
        c.header('Connection', 'keep-alive');

        let validCount = 0;
        let errorCount = 0;
        let recordCount = 0;

        try {
          for await (const record of parseUint8ArrayStream(csvStream, {
            signal,
            engine: EnginePresets.balanced({ workerPool: pool }),
            maxBufferSize: SECURITY_CONFIG.maxBufferSize,
            maxFieldCount: SECURITY_CONFIG.maxFieldCount,
          })) {
            recordCount++;

            // Enforce record count limit
            if (recordCount > SECURITY_CONFIG.maxRecordCount) {
              await stream.write(`event: fatal\n`);
              await stream.write(`data: ${JSON.stringify({
                error: 'Record count limit exceeded',
                limit: SECURITY_CONFIG.maxRecordCount,
                bytesRead: byteLimitStream.getBytesRead(),
              })}\n\n`);
              // Exit loop - SSE already started, cannot change HTTP status
              return;
            }

            // Enforce error count limit
            if (errorCount >= SECURITY_CONFIG.maxErrorCount) {
              await stream.write(`event: fatal\n`);
              await stream.write(`data: ${JSON.stringify({
                error: 'Error count limit exceeded - stopping validation',
                limit: SECURITY_CONFIG.maxErrorCount,
                valid: validCount,
                errors: errorCount,
                bytesRead: byteLimitStream.getBytesRead(),
              })}\n\n`);
              // Exit loop - SSE already started, cannot change HTTP status
              return;
            }

            try {
              // Validate each record
              recordSchema.parse(record);
              validCount++;
            } catch (error) {
              errorCount++;
              if (error instanceof z.ZodError) {
                const errorMessage = {
                  line: validCount + errorCount,
                  errors: error.issues.map((e) => ({
                    path: e.path.join('.'),
                    message: e.message,
                  })),
                };

                // Send error as SSE event
                await stream.write(`event: error\n`);
                await stream.write(`data: ${JSON.stringify(errorMessage)}\n\n`);

                // Log first 10 errors for monitoring
                if (errorCount <= 10) {
                  console.warn('CSV validation error:', errorMessage);
                }
              }
            }
          }

          // Send summary as final SSE event
          await stream.write(`event: summary\n`);
          await stream.write(`data: ${JSON.stringify({
            valid: validCount,
            errors: errorCount,
            total: recordCount,
            bytesRead: byteLimitStream.getBytesRead(),
          })}\n\n`);
        } catch (error) {
          // All fatal errors after SSE starts must be sent as fatal events
          // Cannot change HTTP status after headers are sent

          // Check if byte limit was exceeded (regardless of error type)
          if (byteLimitStream.hasExceededLimit()) {
            await stream.write(`event: fatal\n`);
            await stream.write(`data: ${JSON.stringify({
              error: 'Request body size limit exceeded',
              bytesRead: byteLimitStream.getBytesRead(),
              limit: SECURITY_CONFIG.maxRequestBodySize,
            })}\n\n`);
            return; // Close stream
          }

          if (error instanceof Error && error.name === 'AbortError') {
            await stream.write(`event: fatal\n`);
            await stream.write(`data: ${JSON.stringify({
              error: 'Parsing timeout',
              bytesRead: byteLimitStream.getBytesRead(),
            })}\n\n`);
            return; // Close stream
          }
          if (error instanceof RangeError) {
            // Byte limit exceeded from TransformStream
            await stream.write(`event: fatal\n`);
            await stream.write(`data: ${JSON.stringify({
              error: 'Request body size limit exceeded',
              bytesRead: byteLimitStream.getBytesRead(),
              limit: SECURITY_CONFIG.maxRequestBodySize,
            })}\n\n`);
            return; // Close stream
          }
          if (error instanceof ParseError) {
            await stream.write(`event: fatal\n`);
            await stream.write(`data: ${JSON.stringify({
              error: 'Invalid CSV format',
              details: error.message,
            })}\n\n`);
            return; // Close stream
          }

          // Other non-fatal errors: send error event
          await stream.write(`event: error\n`);
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          await stream.write(`data: ${JSON.stringify({ error: errorMessage })}\n\n`);
        }
      });
    } catch (error) {
      // This catch block should only handle errors BEFORE SSE starts
      // After SSE starts (202 sent), errors are handled inside the stream callback
      // If we reach here, SSE has NOT started yet, so we can return error status codes

      if (error instanceof ParseError) {
        return c.json({ error: 'Invalid CSV format', details: error.message }, 400);
      }
      return c.json({ error: 'Internal server error' }, 500);
    }
  });

  return app;
}
