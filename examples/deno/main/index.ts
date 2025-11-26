import { parseString } from 'npm:web-csv-toolbox';

console.log('🦕 Deno Main Version Test');
console.log('Features: Auto WASM initialization via npm: prefix\n');

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

async function testWASM() {
  console.log('Test 2: WASM (auto-initialized)');
  console.log('----------------------------------------');

  // Use the unified API with engine.wasm option
  const result = parseString.toArraySync(csv, { engine: { wasm: true } });

  console.log('✅ Parsed Result:');
  console.log(JSON.stringify(result, null, 2));
  console.log();
}

try {
  await testJavaScriptEngine();
  await testWASM();
  console.log('✨ Success! All tests passed in Deno Main version');
} catch (error) {
  console.error('❌ Error:', error);
  Deno.exit(1);
}
