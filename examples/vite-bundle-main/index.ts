import { parseStringToArraySyncWASM } from 'web-csv-toolbox';

const csv = 'name,age\nAlice,30\nBob,25';
const result = parseStringToArraySyncWASM(csv);
console.log('Main bundle result:', result);
console.log('Bundle includes auto-initialized WASM (base64-inlined)');
