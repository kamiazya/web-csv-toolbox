import { loadWasm, parseStringToArraySyncWasm } from 'web-csv-toolbox/slim';

console.log('🦕 Deno Slim Entry Test');
console.log('Features: Manual Wasm initialization via npm: prefix, smaller JS bundle\n');

try {
  const csv = 'name,age\nAlice,30\nBob,25\nCharlie,35';

  console.log('CSV Input:');
  console.log(csv);
  console.log();

  // Slim entry: Must initialize Wasm manually
  // For local development, specify the Wasm file path explicitly
  console.log('⏳ Initializing Wasm...');
  const wasmPath = new URL('../../../dist/csv.wasm', import.meta.url);
  await loadWasm(wasmPath);
  console.log('✅ Wasm initialized\n');

  // Now we can use sync Wasm APIs
  const result = parseStringToArraySyncWasm(csv);

  console.log('✅ Parsed Result:');
  console.log(JSON.stringify(result, null, 2));
  console.log();
  console.log('✨ Success! Slim entry works in Deno');
} catch (error) {
  console.error('❌ Error:', error);
  Deno.exit(1);
}
