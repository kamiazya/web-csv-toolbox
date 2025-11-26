---
"web-csv-toolbox": minor
---

Implement discriminated union pattern for `EngineConfig` to improve type safety

## Breaking Changes

### 1. EngineConfig Type Structure

`EngineConfig` is now a discriminated union based on the `worker` property:

**Before:**
```typescript
interface EngineConfig {
  worker?: boolean;
  workerURL?: string | URL;
  workerPool?: WorkerPool;
  workerStrategy?: WorkerCommunicationStrategy;
  strict?: boolean;
  onFallback?: (info: EngineFallbackInfo) => void;
  wasm?: boolean;
  // ... other properties
}
```

**After:**
```typescript
// Base configuration shared by all modes
interface BaseEngineConfig {
  wasm?: boolean;
  arrayBufferThreshold?: number;
  backpressureCheckInterval?: BackpressureCheckInterval;
  queuingStrategy?: QueuingStrategyConfig;
}

// Main thread configuration (worker is false or undefined)
interface MainThreadEngineConfig extends BaseEngineConfig {
  worker?: false;
}

// Worker configuration (worker must be true)
interface WorkerEngineConfig extends BaseEngineConfig {
  worker: true;
  workerURL?: string | URL;
  workerPool?: WorkerPool;
  workerStrategy?: WorkerCommunicationStrategy;
  strict?: boolean;
  onFallback?: (info: EngineFallbackInfo) => void;
}

// Union type
type EngineConfig = MainThreadEngineConfig | WorkerEngineConfig;
```

### 2. Type Safety Improvements

Worker-specific properties are now only available when `worker: true`:

```typescript
// ✅ Valid - worker: true allows worker-specific properties
const config1: EngineConfig = {
  worker: true,
  workerURL: './worker.js',    // ✅ Type-safe
  workerStrategy: 'stream-transfer',
  strict: true
};

// ✅ Valid - worker: false doesn't require worker properties
const config2: EngineConfig = {
  worker: false,
  wasm: true
};

// ❌ Type Error - worker: false cannot have workerURL
const config3: EngineConfig = {
  worker: false,
  workerURL: './worker.js'  // ❌ Type error!
};
```

### 3. EnginePresets Options Split

`EnginePresetOptions` is now split into two interfaces for better type safety:

**Before:**
```typescript
interface EnginePresetOptions {
  workerPool?: WorkerPool;
  workerURL?: string | URL;
  onFallback?: (info: EngineFallbackInfo) => void;
  arrayBufferThreshold?: number;
  // ...
}

EnginePresets.mainThread(options?: EnginePresetOptions)
EnginePresets.fastest(options?: EnginePresetOptions)
```

**After:**
```typescript
// For main thread presets (mainThread, wasm)
interface MainThreadPresetOptions extends BasePresetOptions {
  // No worker-related options
}

// For worker-based presets (worker, fastest, balanced, etc.)
interface WorkerPresetOptions extends BasePresetOptions {
  workerPool?: WorkerPool;
  workerURL?: string | URL;
  onFallback?: (info: EngineFallbackInfo) => void;
}

EnginePresets.mainThread(options?: MainThreadPresetOptions)
EnginePresets.fastest(options?: WorkerPresetOptions)
```

**Migration:**
```typescript
// Before: No type error, but logically incorrect
EnginePresets.mainThread({ workerURL: './worker.js' })  // Accepted but ignored

// After: Type error prevents mistakes
EnginePresets.mainThread({ workerURL: './worker.js' })  // ❌ Type error!
```

### 4. Transformer Constructor Changes

Queuing strategy parameters changed from optional (`?`) to default parameters:

**Before:**
```typescript
constructor(
  options?: CSVLexerTransformerOptions,
  writableStrategy?: QueuingStrategy<string>,
  readableStrategy?: QueuingStrategy<Token>
)
```

**After:**
```typescript
constructor(
  options: CSVLexerTransformerOptions = {},
  writableStrategy: QueuingStrategy<string> = DEFAULT_WRITABLE_STRATEGY,
  readableStrategy: QueuingStrategy<Token> = DEFAULT_READABLE_STRATEGY
)
```

**Impact:** This is technically a breaking change in the type signature, but **functionally backward compatible** since all parameters still have defaults. Existing code will continue to work without modifications.

## New Features

### 1. Default Strategy Constants

Default queuing strategies are now module-level constants using `CountQueuingStrategy`:

```typescript
// CSVLexerTransformer
const DEFAULT_WRITABLE_STRATEGY: QueuingStrategy<string> = {
  highWaterMark: 65536,
  size: (chunk) => chunk.length,
};
const DEFAULT_READABLE_STRATEGY = new CountQueuingStrategy({ highWaterMark: 1024 });

// CSVRecordAssemblerTransformer
const DEFAULT_WRITABLE_STRATEGY = new CountQueuingStrategy({ highWaterMark: 1024 });
const DEFAULT_READABLE_STRATEGY = new CountQueuingStrategy({ highWaterMark: 256 });
```

### 2. Type Tests

Added comprehensive type tests in `src/common/types.test-d.ts` to validate the discriminated union behavior:

```typescript
// Validates type narrowing
const config: EngineConfig = { worker: true };
expectTypeOf(config).toExtend<WorkerEngineConfig>();

// Validates property exclusion
expectTypeOf<MainThreadEngineConfig>().not.toHaveProperty('workerURL');
```

## Migration Guide

### For TypeScript Users

If you're passing `EngineConfig` objects explicitly typed, you may need to update:

```typescript
// Before: Could accidentally mix incompatible properties
const config: EngineConfig = {
  worker: false,
  workerURL: './worker.js'  // Silently ignored
};

// After: TypeScript catches the mistake
const config: EngineConfig = {
  worker: false,
  // workerURL: './worker.js'  // ❌ Type error - removed
};
```

### For EnginePresets Users

Update preset option types if explicitly typed:

```typescript
// Before
const options: EnginePresetOptions = {
  workerPool: myPool
};
EnginePresets.mainThread(options);  // No error, but workerPool ignored

// After
const options: WorkerPresetOptions = {  // or MainThreadPresetOptions
  workerPool: myPool
};
EnginePresets.fastest(options);  // ✅ Correct usage
// EnginePresets.mainThread(options);  // ❌ Type error - use MainThreadPresetOptions
```

### For Transformer Users

No code changes required. Existing usage continues to work:

```typescript
// Still works exactly as before
new CSVLexerTransformer();
new CSVLexerTransformer({ delimiter: ',' });
new CSVLexerTransformer({}, customWritable, customReadable);
```

## Benefits

1. **IDE Autocomplete**: Better suggestions based on `worker` setting
2. **Type Safety**: Prevents invalid property combinations
3. **Self-Documenting**: Type system enforces valid configurations
4. **Catch Errors Early**: TypeScript catches configuration mistakes at compile time
5. **Standards Compliance**: Uses `CountQueuingStrategy` from Web Streams API
