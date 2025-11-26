import { parseString } from 'web-csv-toolbox';

const csv = 'name,age\nAlice,30\nBob,25';
// Use the unified API with engine.wasm option
const result = parseString.toArraySync(csv, { engine: { wasm: true } });
console.log('Main bundle result:', result);
console.log('Bundle includes auto-initialized WASM (base64-inlined)');
