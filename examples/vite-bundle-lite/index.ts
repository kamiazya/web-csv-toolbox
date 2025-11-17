import { loadWASM, parseStringToArraySyncWASM } from 'web-csv-toolbox/lite';
// Import WASM file URL from the package
import wasmUrl from 'web-csv-toolbox/csv.wasm?url';

// Get DOM elements
const statusElement = document.getElementById('status')!;
const resultElement = document.getElementById('result')!;

try {
  console.log('Lite bundle: Loading WASM via streaming (no base64 inlining)...');
  resultElement.textContent = 'Loading WASM via streaming fetch...\n';

  // Lite version requires manual WASM initialization via streaming
  // Vite will automatically resolve the WASM URL from node_modules
  await loadWASM(wasmUrl);

  console.log('WASM loaded successfully!');
  statusElement.className = 'status success';
  statusElement.textContent = '✅ WASM loaded successfully via streaming!';
  resultElement.textContent += '✅ WASM loaded successfully!\n\n';

  const csv = 'name,age\nAlice,30\nBob,25';
  const result = parseStringToArraySyncWASM(csv);

  console.log('Lite bundle result:', result);
  resultElement.textContent += 'CSV Input:\n' + csv + '\n\n';
  resultElement.textContent += 'Parsed Result:\n' + JSON.stringify(result, null, 2) + '\n\n';
  resultElement.textContent += '📦 Bundle size is ~110KB smaller (no base64-inlined WASM)';
} catch (error) {
  console.error('Error:', error);
  statusElement.className = 'status error';
  statusElement.textContent = '❌ Error: ' + (error as Error).message;
  resultElement.textContent += '\n❌ Error: ' + (error as Error).message;
}
