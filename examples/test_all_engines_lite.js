import { parseString, loadWASM } from 'web-csv-toolbox/lite';

const csv = 'name,age\nAlice,30\nBob,25';

console.log('🧪 Testing all Engine combinations (Lite Version)\n');
console.log('⏳ Initializing WASM...');
await loadWASM();
console.log('✅ WASM initialized\n');

async function testEngine(name, options) {
  try {
    const records = [];
    for await (const record of parseString(csv, options)) {
      records.push(record);
    }
    console.log(`✅ ${name}: SUCCESS`);
    console.log(`   Result: ${JSON.stringify(records[0])}`);
    return true;
  } catch (error) {
    console.log(`❌ ${name}: FAILED`);
    console.log(`   Error: ${error.message}`);
    return false;
  }
}

async function runTests() {
  const results = {
    passed: 0,
    failed: 0
  };

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('Main Thread Tests');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  // 1. JavaScript Engine (main thread, no WASM)
  if (await testEngine('JavaScript Engine (main thread)', { engine: { worker: false, wasm: false } })) {
    results.passed++;
  } else {
    results.failed++;
  }

  // 2. WASM Engine (main thread)
  if (await testEngine('WASM Engine (main thread)', { engine: { worker: false, wasm: true } })) {
    results.passed++;
  } else {
    results.failed++;
  }

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('Worker Tests');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  // 3. Worker + JavaScript Engine
  if (await testEngine('Worker + JavaScript Engine', { engine: { worker: true, wasm: false } })) {
    results.passed++;
  } else {
    results.failed++;
  }

  // 4. Worker + WASM Engine
  if (await testEngine('Worker + WASM Engine', { engine: { worker: true, wasm: true } })) {
    results.passed++;
  } else {
    results.failed++;
  }

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('Summary');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  console.log(`✅ Passed: ${results.passed}/4`);
  console.log(`❌ Failed: ${results.failed}/4`);

  if (results.failed === 0) {
    console.log('\n🎉 All engine combinations work correctly in Lite version!');
  } else {
    console.log('\n⚠️  Some engine combinations failed.');
    process.exit(1);
  }
}

runTests().catch(console.error);
