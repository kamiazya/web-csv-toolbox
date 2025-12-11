# Security Policy

## Reporting Security Vulnerabilities

If you discover a security vulnerability in web-csv-toolbox, please report it privately through GitHub Security Advisories:

**👉 [Report a Vulnerability](https://github.com/kamiazya/web-csv-toolbox/security/advisories/new)**

**Please include:**
- Description of the vulnerability
- Steps to reproduce
- Potential impact
- Suggested fix (if any)

**Response:**
- Security reports will be reviewed and addressed on a best-effort basis
- Critical vulnerabilities will be prioritized

## Supported Versions

| Version | Supported          |
|---------|--------------------|
| 0.x.x   | ✅ (latest only)   |

We provide security updates for the latest minor version only.

## Secure Usage Guidelines

⚠️ **Critical for Production Applications**

When processing user-uploaded CSV files, **always implement resource limits** to prevent Denial of Service (DoS) attacks.

### Quick Security Checklist

Before deploying to production:

- [ ] **WorkerPool configured** with `maxWorkers` limit (2-4 for web apps)
- [ ] **Early rejection** implemented with `pool.isFull()`
- [ ] **Content-Type validation** (`text/csv` only)
- [ ] **Content-Length check** before reading body
- [ ] **Timeout protection** with `AbortSignal.timeout()`
- [ ] **Built-in limits** configured (`maxBufferSize`, `maxFieldCount`)
- [ ] **Schema validation** with Zod or similar (e.g., email, age ranges)
- [ ] **Error logging** for security monitoring
- [ ] **Rate limiting** at application/infrastructure level

### Minimal Secure Configuration

```typescript
import { Hono } from 'hono';
import { stream } from 'hono/streaming';
import { WorkerPool, EnginePresets, parseStringStream } from 'web-csv-toolbox';

const app = new Hono();

// 1. Limit concurrent workers
const pool = new WorkerPool({ maxWorkers: 4 });

app.onShutdown(() => {
  pool.terminate();
});

app.post('/validate-csv', async (c) => {
  // 2. Early rejection if pool is saturated
  if (pool.isFull()) {
    return c.json({ error: 'Service busy, try again later' }, 503);
  }

  // 3. Verify Content-Type
  const contentType = c.req.header('Content-Type');
  if (!contentType?.startsWith('text/csv')) {
    return c.json({ error: 'Content-Type must be text/csv' }, 400);
  }

  // 4. Get request body as stream
  const csvStream = c.req.raw.body?.pipeThrough(new TextDecoderStream());
  if (!csvStream) {
    return c.json({ error: 'Request body required' }, 400);
  }

  // 5. Process with resource limits
  const signal = AbortSignal.timeout(30000); // 30s timeout

  return stream(c, async (stream) => {
    c.header('Content-Type', 'text/event-stream');

    for await (const record of parseStringStream(csvStream, {
      signal,
      engine: EnginePresets.recommended({ workerPool: pool }),
      maxBufferSize: 10 * 1024 * 1024,  // 10M chars
      maxFieldCount: 100_000,             // 100k fields
    })) {
      // Validate and process...
    }
  });
});
```

## Documentation

For comprehensive security implementation:

📖 **[How-To: Secure CSV Processing](./docs/how-to-guides/secure-csv-processing.md)** - Step-by-step implementation guide

💡 **[Security Model](./docs/explanation/security-model.md)** - Understanding the security architecture

## Known Security Considerations

### 1. Resource Exhaustion (DoS)

**Threat:** Attackers upload multiple large CSV files simultaneously to overwhelm server resources.

**Mitigation:** Use `WorkerPool` with limited `maxWorkers` setting.

**Severity:** 🔴 High (can cause service outage)

### 2. Memory Exhaustion

**Threat:** Extremely long fields or massive number of records consume excessive memory.

**Mitigation:** Configure `maxBufferSize` and `maxFieldCount`.

**Severity:** 🟡 Medium (can cause crashes)

### 3. CPU Exhaustion

**Threat:** Maliciously crafted CSV files with complex escaping slow down parsing.

**Mitigation:** Use timeout protection with `AbortSignal`.

**Severity:** 🟡 Medium (can degrade performance)

### 4. Compression Bombs

**Threat:** Small compressed file expands to enormous size when decompressed.

**Mitigation:** Implement stream-based size limits before parsing.

**Severity:** 🟡 Medium (can exhaust disk/memory)

## Built-in Protections

web-csv-toolbox includes these built-in security features:

- **Buffer size limits** (default: 10M characters)
- **Field count limits** (default: 100k fields/record)
- **Binary size limits** (default: 100MB for ArrayBuffer/Uint8Array)
- **Automatic RangeError** on limit violations

These provide a baseline defense, but **application-level controls** (WorkerPool, timeouts, validation) are essential for production deployments.

## Security Best Practices

### Defense in Depth

Implement multiple security layers:

1. **Infrastructure:** Rate limiting, WAF, CDN
2. **Application:** WorkerPool limits, size checks, timeouts
3. **Library:** Built-in limits (maxBufferSize, maxFieldCount)
4. **Data:** Schema validation (Zod, etc.)

### Fail Fast

Reject invalid requests as early as possible:

```typescript
// ✅ Good: Early rejection
if (pool.isFull()) return 503;

// ❌ Bad: Queue and timeout later
await queueRequest();  // Wastes resources
```

### Monitoring

Log security-relevant events:

```typescript
if (pool.isFull()) {
  console.warn('WorkerPool saturated - possible attack', {
    ip: c.req.header('X-Forwarded-For'),
    timestamp: new Date().toISOString()
  });
  // Alert monitoring system
}
```

## Disclosure Policy

We follow responsible disclosure:

1. **Report received** → Private acknowledgment
2. **Vulnerability confirmed** → Private discussion of fix
3. **Patch developed** → Testing and validation
4. **Patch released** → Public disclosure with credit

Security fixes will be addressed on a best-effort basis as this is a personal open-source project.

## Security Updates

Security patches are released as:
- **Patch releases** (0.x.Y) for current minor version
- **Security advisories** on GitHub
- **Release notes** highlighting security fixes

Subscribe to releases on [GitHub](https://github.com/kamiazya/web-csv-toolbox/releases) to stay informed.

## Attribution

We credit security researchers who responsibly disclose vulnerabilities (with permission).

## Contact

For general security questions (non-vulnerability): Open a [GitHub Discussion](https://github.com/kamiazya/web-csv-toolbox/discussions)
