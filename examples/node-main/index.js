import { parseString } from 'web-csv-toolbox';

console.log('🚀 Node.js Main Version Test');
console.log('Features: Auto WASM initialization\n');

try {
  const csv = 'name,age\nAlice,30\nBob,25\nCharlie,35';

  console.log('CSV Input:');
  console.log(csv);
  console.log();

  // Main version: Use async API
  const records = [];
  for await (const record of parseString(csv)) {
    records.push(record);
  }

  console.log('✅ Parsed Result:');
  console.log(JSON.stringify(records, null, 2));
  console.log();
  console.log('✨ Success! Main version works in Node.js');
} catch (error) {
  console.error('❌ Error:', error);
  process.exit(1);
}
