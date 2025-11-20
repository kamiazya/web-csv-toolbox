import { loadWASM, parseStringToArraySyncWASM } from 'web-csv-toolbox/slim';

console.log('🦕 Deno Slim Entry Test');
console.log('Features: Manual WASM initialization, smaller JS bundle\n');

try {
  const csv = 'name,age\nAlice,30\nBob,25\nCharlie,35';

  console.log('CSV Input:');
  console.log(csv);
  console.log();

  // Slim entry: Must initialize WASM manually
  console.log('⏳ Initializing WASM...');
  // Resolve the path to the WASM file
  const wasmPath = new URL('../../dist/csv.wasm', import.meta.url);
  await loadWASM(wasmPath.href);
  console.log('✅ WASM initialized\n');

  // Now we can use sync WASM APIs
  const result = parseStringToArraySyncWASM(csv);

  console.log('✅ Parsed Result:');
  console.log(JSON.stringify(result, null, 2));
  console.log();
  console.log('✨ Success! Slim entry works in Deno');
} catch (error) {
  console.error('❌ Error:', error);
  Deno.exit(1);
}
