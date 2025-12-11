import { parseString, parseStringToArraySyncWasm } from 'web-csv-toolbox';

console.log('🚀 Node.js Main Version Test');
console.log('Features: Auto Wasm initialization\n');

const csv = 'name,age\nAlice,30\nBob,25\nCharlie,35';

console.log('CSV Input:');
console.log(csv);
console.log();

async function testJavaScriptEngine() {
  console.log('Test 1: JavaScript Engine');
  console.log('----------------------------------------');

  const records = [];
  for await (const record of parseString(csv)) {
    records.push(record);
  }

  console.log('✅ Parsed Result:');
  console.log(JSON.stringify(records, null, 2));
  console.log();
}

async function testWasm() {
  console.log('Test 2: Wasm (auto-initialized)');
  console.log('----------------------------------------');

  const result = parseStringToArraySyncWasm(csv);

  console.log('✅ Parsed Result:');
  console.log(JSON.stringify(result, null, 2));
  console.log();
}

try {
  await testJavaScriptEngine();
  await testWasm();
  console.log('✨ Success! All tests passed in Node.js Main version');
} catch (error) {
  console.error('❌ Error:', error);
  process.exit(1);
}
