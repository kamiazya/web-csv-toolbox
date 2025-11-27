import {
  parseString,
  parseStringToArraySyncWASM,
  EnginePresets,
} from 'web-csv-toolbox';

console.log('🚀 Node.js Main Version - Engine Test Suite');
console.log('============================================\n');

const csv = 'name,age,city\nAlice,30,Tokyo\nBob,25,Osaka\nCharlie,35,Kyoto';

// Generate larger CSV for performance testing
function generateLargeCSV(rows) {
  const lines = ['id,name,value'];
  for (let i = 0; i < rows; i++) {
    lines.push(`${i},item${i},${Math.random() * 1000}`);
  }
  return lines.join('\n');
}

console.log('Test CSV:');
console.log(csv);
console.log();

// Engine availability info
function printEngineInfo() {
  console.log('Engine Availability in Node.js:');
  console.log('----------------------------------------');
  console.log('✅ JavaScript (stable)  - Available');
  console.log('✅ WASM                 - Available');
  console.log('⚠️  Worker              - Available (requires worker setup)');
  console.log('❌ GPU (WebGPU)         - Not available in Node.js');
  console.log('');
  console.log('Note: For GPU testing, use browser-engine-test example.');
  console.log();
}

// Test 1: JavaScript Engine (stable preset)
async function testStablePreset() {
  console.log('Test 1: stable() Preset (JavaScript Engine)');
  console.log('----------------------------------------');
  console.log('Config: { worker: false, wasm: false, gpu: false }');

  const start = performance.now();
  const records = [];
  for await (const record of parseString(csv, {
    engine: EnginePresets.stable(),
  })) {
    records.push(record);
  }
  const elapsed = performance.now() - start;

  console.log(`✅ Parsed ${records.length} records in ${elapsed.toFixed(2)}ms`);
  console.log('First record:', JSON.stringify(records[0]));
  console.log();
  return records;
}

// Test 2: WASM Engine (direct)
async function testWASMDirect() {
  console.log('Test 2: WASM Engine (parseStringToArraySyncWASM)');
  console.log('----------------------------------------');

  const start = performance.now();
  const result = parseStringToArraySyncWASM(csv);
  const elapsed = performance.now() - start;

  console.log(`✅ Parsed ${result.length} records in ${elapsed.toFixed(2)}ms`);
  console.log('First record:', JSON.stringify(result[0]));
  console.log();
  return result;
}

// Test 3: WASM via engine config
async function testWASMViaConfig() {
  console.log('Test 3: WASM via Engine Config');
  console.log('----------------------------------------');
  console.log('Config: { wasm: true, worker: false, gpu: false }');

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
    engine: EnginePresets.stable(),
  })) {
    jsCount++;
  }
  const jsElapsed = performance.now() - jsStart;

  // WASM
  const wasmStart = performance.now();
  const wasmResult = parseStringToArraySyncWASM(largeCSV);
  const wasmElapsed = performance.now() - wasmStart;

  console.log(`JavaScript: ${jsElapsed.toFixed(2)}ms (${jsCount} records)`);
  console.log(`WASM:       ${wasmElapsed.toFixed(2)}ms (${wasmResult.length} records)`);
  console.log(`Speedup:    ${(jsElapsed / wasmElapsed).toFixed(2)}x`);
  console.log();
}

try {
  printEngineInfo();
  await testStablePreset();
  await testWASMDirect();
  await testWASMViaConfig();
  await testPerformance();
  console.log('✨ Success! All tests passed in Node.js');
} catch (error) {
  console.error('❌ Error:', error);
  process.exit(1);
}
