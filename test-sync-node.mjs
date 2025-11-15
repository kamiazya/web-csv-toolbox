import { parseStringToArraySyncWASM } from './dist/web-csv-toolbox.js';
import { loadWASMSync, isSyncInitialized, getWasmModule } from './dist/wasm/loadWASM.sync.node.js';

console.log('Testing synchronous WASM initialization in Node.js...');

console.log('1. Before init - isSyncInitialized():', isSyncInitialized());
console.log('2. getWasmModule():', getWasmModule());

try {
  console.log('3. Manually calling loadWASMSync()...');
  loadWASMSync();
  console.log('4. After manual init - isSyncInitialized():', isSyncInitialized());

  const wasmModule = getWasmModule();
  console.log('5. getWasmModule() exists?', !!wasmModule);
  console.log('6. getWasmModule().parseStringToArraySync exists?', typeof wasmModule?.parseStringToArraySync);

  // Test via parseStringToArraySyncWASM
  console.log('7. Testing via parseStringToArraySyncWASM...');
  const csv = 'name,age\nAlice,30\nBob,25';
  const result = parseStringToArraySyncWASM(csv);
  console.log('✅ Success! Parsed result:', result);

  // Second call
  const result2 = parseStringToArraySyncWASM('a,b\n1,2');
  console.log('✅ Second call successful:', result2);

} catch (error) {
  console.error('❌ Error:', error.message);
  console.error('Stack:', error.stack);
  process.exit(1);
}
