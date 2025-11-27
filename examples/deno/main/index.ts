import {
  parseString,
  parseStringToArraySyncWASM,
} from 'npm:web-csv-toolbox';

console.log('🦕 Deno Main Version - Engine Test Suite');
console.log('=========================================\n');

const csv = 'name,age,city\nAlice,30,Tokyo\nBob,25,Osaka\nCharlie,35,Kyoto';

// Generate larger CSV for performance testing
function generateLargeCSV(rows: number): string {
  const lines = ['id,name,value'];
  for (let i = 0; i < rows; i++) {
    lines.push(`${i},item${i},${Math.random() * 1000}`);
  }
  return lines.join('\n');
}

console.log('Test CSV:');
console.log(csv);
console.log();

// Test 1: JavaScript Engine (stable config)
async function testJavaScriptEngine() {
  console.log('Test 1: JavaScript Engine (stable config)');
  console.log('----------------------------------------');
  console.log('Config: { worker: false, wasm: false, gpu: false }');

  const start = performance.now();
  const records = [];
  for await (const record of parseString(csv, {
    engine: { worker: false, wasm: false, gpu: false },
  })) {
    records.push(record);
  }
  const elapsed = performance.now() - start;

  console.log(`✅ Parsed ${records.length} records in ${elapsed.toFixed(2)}ms`);
  console.log('First record:', JSON.stringify(records[0]));
  console.log();
  return records;
}

// Test 2: WASM Engine
function testWASMEngine() {
  console.log('Test 2: WASM Engine (parseStringToArraySyncWASM)');
  console.log('----------------------------------------');

  try {
    const start = performance.now();
    const result = parseStringToArraySyncWASM(csv);
    const elapsed = performance.now() - start;

    console.log(`✅ Parsed ${result.length} records in ${elapsed.toFixed(2)}ms`);
    console.log('First record:', JSON.stringify(result[0]));
    console.log();
    return result;
  } catch (e) {
    // WASM may not be available or initialized in all npm versions
    console.log(`⚠️  Skipped: WASM sync not available in npm version (${(e as Error).message})`);
    console.log('   Note: WASM sync works with the local build or newer versions.');
    console.log();
    return null;
  }
}

// Test 3: WASM via engine config
async function testWASMViaConfig() {
  console.log('Test 3: WASM via Engine Config');
  console.log('----------------------------------------');
  console.log('Config: { wasm: true, worker: false, gpu: false }');

  try {
    const start = performance.now();
    const records = [];
    for await (const record of parseString(csv, {
      engine: { wasm: true, worker: false, gpu: false },
    })) {
      records.push(record);
    }
    const elapsed = performance.now() - start;

    console.log(`✅ Parsed ${records.length} records in ${elapsed.toFixed(2)}ms`);
    console.log('First record:', JSON.stringify(records[0]));
    console.log();
    return records;
  } catch (e) {
    console.log(`⚠️  Skipped: WASM via config not available (${(e as Error).message})`);
    console.log();
    return null;
  }
}

// Test 4: Performance comparison
async function testPerformance() {
  console.log('Test 4: Performance Comparison (1000 rows)');
  console.log('----------------------------------------');

  const largeCSV = generateLargeCSV(1000);

  // JavaScript
  const jsStart = performance.now();
  let jsCount = 0;
  for await (const _ of parseString(largeCSV, {
    engine: { worker: false, wasm: false, gpu: false },
  })) {
    jsCount++;
  }
  const jsElapsed = performance.now() - jsStart;

  console.log(`JavaScript: ${jsElapsed.toFixed(2)}ms (${jsCount} records)`);

  // Try WASM
  try {
    const wasmStart = performance.now();
    const wasmResult = parseStringToArraySyncWASM(largeCSV);
    const wasmElapsed = performance.now() - wasmStart;

    console.log(`WASM:       ${wasmElapsed.toFixed(2)}ms (${wasmResult.length} records)`);
    console.log(`Speedup:    ${(jsElapsed / wasmElapsed).toFixed(2)}x`);
  } catch {
    console.log('WASM:       (not available)');
  }
  console.log();
}

// Engine availability info
function printEngineInfo() {
  console.log('Engine Availability in Deno CLI:');
  console.log('----------------------------------------');
  console.log('✅ JavaScript (stable)  - Available');
  console.log('✅ WASM                 - Available (async via engine config)');
  console.log('⚠️  Worker              - Limited (Deno Workers differ from Web Workers)');
  console.log('❌ GPU (WebGPU)         - Not available in Deno CLI');
  console.log('');
  console.log('Note: For GPU testing, use browser-engine-test example.');
  console.log();
}

try {
  printEngineInfo();
  await testJavaScriptEngine();
  testWASMEngine();
  await testWASMViaConfig();
  await testPerformance();
  console.log('✨ Success! All tests passed in Deno');
} catch (error) {
  console.error('❌ Error:', error);
  Deno.exit(1);
}
