import { loadWASM, parseString } from 'npm:web-csv-toolbox/slim';

console.log('🦕 Deno Slim Entry Test');
console.log('Features: Manual WASM initialization via npm: prefix, smaller JS bundle\n');

try {
  const csv = 'name,age\nAlice,30\nBob,25\nCharlie,35';

  console.log('CSV Input:');
  console.log(csv);
  console.log();

  // Slim entry: Must initialize WASM manually
  // With npm: prefix, Deno uses Node.js loader which auto-resolves WASM path
  console.log('⏳ Initializing WASM...');
  await loadWASM(); // No argument needed - will use import.meta.resolve internally
  console.log('✅ WASM initialized\n');

  // Use the unified API with engine.wasm option
  const result = parseString.toArraySync(csv, { engine: { wasm: true } });

  console.log('✅ Parsed Result:');
  console.log(JSON.stringify(result, null, 2));
  console.log();
  console.log('✨ Success! Slim entry works in Deno');
} catch (error) {
  console.error('❌ Error:', error);
  Deno.exit(1);
}
