import { loadWASM, parseStringToArraySyncWASM } from 'web-csv-toolbox/lite';

console.log('🚀 Node.js Lite Version Test');
console.log('Features: Manual WASM initialization, smaller bundle\n');

try {
  const csv = 'name,age\nAlice,30\nBob,25\nCharlie,35';

  console.log('CSV Input:');
  console.log(csv);
  console.log();

  // Lite version: Must initialize WASM manually
  console.log('⏳ Initializing WASM...');
  await loadWASM();
  console.log('✅ WASM initialized\n');

  // Now we can use sync WASM APIs
  const result = parseStringToArraySyncWASM(csv);

  console.log('✅ Parsed Result:');
  console.log(JSON.stringify(result, null, 2));
  console.log();
  console.log('✨ Success! Lite version works in Node.js');
} catch (error) {
  console.error('❌ Error:', error);
  process.exit(1);
}
