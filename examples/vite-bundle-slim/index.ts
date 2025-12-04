import { loadWasm, parseStringToArraySyncWasm } from 'web-csv-toolbox/slim';
// Import Wasm file URL from the package
import wasmUrl from 'web-csv-toolbox/csv.wasm?url';

// Get DOM elements
const statusElement = document.getElementById('status')!;
const resultElement = document.getElementById('result')!;

try {
  console.log('Slim bundle: Loading Wasm via streaming (no base64 inlining)...');
  resultElement.textContent = 'Loading Wasm via streaming fetch...\n';

  // Slim entry requires manual Wasm initialization via streaming
  // Vite will automatically resolve the Wasm URL from node_modules
  await loadWasm(wasmUrl);

  console.log('Wasm loaded successfully!');
  statusElement.className = 'status success';
  statusElement.textContent = '✅ Wasm loaded successfully via streaming!';
  resultElement.textContent += '✅ Wasm loaded successfully!\n\n';

  const csv = 'name,age\nAlice,30\nBob,25';
  const result = parseStringToArraySyncWasm(csv);

  console.log('Slim bundle result:', result);
  resultElement.textContent += 'CSV Input:\n' + csv + '\n\n';
  resultElement.textContent += 'Parsed Result:\n' + JSON.stringify(result, null, 2) + '\n\n';
  resultElement.textContent += '📦 Bundle size is ~110KB smaller (no base64-inlined Wasm)';
} catch (error) {
  console.error('Error:', error);
  statusElement.className = 'status error';
  statusElement.textContent = '❌ Error: ' + (error as Error).message;
  resultElement.textContent += '\n❌ Error: ' + (error as Error).message;
}
