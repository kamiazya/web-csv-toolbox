import { parseStringToArraySyncWasm } from 'web-csv-toolbox';

const csv = 'name,age\nAlice,30\nBob,25';
const result = parseStringToArraySyncWasm(csv);
console.log('Main bundle result:', result);
console.log('Bundle includes auto-initialized Wasm (base64-inlined)');
