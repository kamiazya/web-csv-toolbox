import { loadWasm, parseStringToArraySyncWasm } from 'web-csv-toolbox/slim';

console.log('🚀 Node.js Slim Entry Test');
console.log('Features: Manual Wasm initialization, smaller JS bundle\n');

try {
  const csv = 'name,age\nAlice,30\nBob,25\nCharlie,35';

  console.log('CSV Input:');
  console.log(csv);
  console.log();

  // Slim entry: Must initialize Wasm manually
  console.log('⏳ Initializing Wasm...');
  await loadWasm();
  console.log('✅ Wasm initialized\n');

  // Now we can use sync Wasm APIs
  const result = parseStringToArraySyncWasm(csv);

  console.log('✅ Parsed Result:');
  console.log(JSON.stringify(result, null, 2));
  console.log();
  console.log('✨ Success! Slim entry works in Node.js');
} catch (error) {
  console.error('❌ Error:', error);
  process.exit(1);
}
