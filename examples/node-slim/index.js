import { loadWASM, parseString } from 'web-csv-toolbox/slim';

console.log('🚀 Node.js Slim Entry Test');
console.log('Features: Manual WASM initialization, smaller JS bundle\n');

try {
  const csv = 'name,age\nAlice,30\nBob,25\nCharlie,35';

  console.log('CSV Input:');
  console.log(csv);
  console.log();

  // Slim entry: Must initialize WASM manually
  console.log('⏳ Initializing WASM...');
  await loadWASM();
  console.log('✅ WASM initialized\n');

  // Use the unified API with engine.wasm option
  const result = parseString.toArraySync(csv, { engine: { wasm: true } });

  console.log('✅ Parsed Result:');
  console.log(JSON.stringify(result, null, 2));
  console.log();
  console.log('✨ Success! Slim entry works in Node.js');
} catch (error) {
  console.error('❌ Error:', error);
  process.exit(1);
}
