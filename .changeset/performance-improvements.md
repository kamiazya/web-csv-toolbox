---
"web-csv-toolbox": patch
---

## JavaScript Parser Performance Improvements

This release includes significant internal optimizations that improve JavaScript-based CSV parsing performance.

### Before / After Comparison

| Metric | Before (v0.14) | After | Improvement |
|--------|----------------|-------|-------------|
| 1,000 rows parsing | 3.57 ms | 1.77 ms | **50% faster** |
| 5,000 rows parsing | 19.47 ms | 8.96 ms | **54% faster** |
| Throughput (1,000 rows) | 23.8 MB/s | 49.0 MB/s | **2.06x** |
| Throughput (5,000 rows) | 24.0 MB/s | 53.3 MB/s | **2.22x** |

### Optimization Summary

| Optimization | Target | Improvement |
|--------------|--------|-------------|
| Array copy method improvement | Assembler | -8.7% |
| Quoted field parsing optimization | Lexer | Overhead eliminated |
| Object assembler loop optimization | Assembler | -5.4% |
| Regex removal for unquoted fields | Lexer | -14.8% |
| String comparison optimization | Lexer | ~10% |
| Object creation optimization | Lexer | ~20% |
| Non-destructive buffer reading | GC | -46% |
| Token type numeric conversion | Lexer/GC | -7% / -13% |
| Location tracking made optional | Lexer | -19% to -31% |
| Object.create(null) for records | Assembler | -31% |
| Empty-row template cache | Assembler | ~4% faster on sparse CSV |
| Row buffer reuse (no per-record slice) | Assembler | ~6% faster array format |
| Header-length builder preallocation | Assembler | Capacity stays steady on wide CSV |
| Object assembler row buffer pooling | Assembler | Lower GC spikes on object output |
| Lexer segment-buffer pooling | Lexer | Smoother GC for quoted-heavy input |

### Final Performance Results (Pure JavaScript)

| Format | Throughput |
|--------|------------|
| Object format (1,000 rows) | **49.0 MB/s** |
| Array format (1,000 rows) | **89.6 MB/s** |
| Object format (5,000 rows) | **53.3 MB/s** |

Array format is approximately 83% faster (1.83× throughput) than Object format for the same data.
