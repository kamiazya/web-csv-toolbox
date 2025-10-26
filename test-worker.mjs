/**
 * Manual test script to verify worker execution strategy works correctly
 */

import { parseString, parseBinary, parseStringStream, parseUint8ArrayStream } from './dist/web-csv-toolbox.js';

const csv = `name,age,city
Alice,30,Tokyo
Bob,25,Osaka
Charlie,35,Kyoto`;

const csvBinary = new TextEncoder().encode(csv);

console.log('=== Testing parseString with worker ===');
try {
  const records = [];
  for await (const record of parseString(csv, { execution: ['worker'] })) {
    records.push(record);
  }
  console.log('✅ parseString with worker succeeded');
  console.log('Records:', records);
} catch (error) {
  console.error('❌ parseString with worker failed:', error.message);
}

console.log('\n=== Testing parseBinary with worker ===');
try {
  const records = [];
  const result = parseBinary(csvBinary, { execution: ['worker'] });
  const iterator = result instanceof Promise ? await result : result;
  for await (const record of iterator) {
    records.push(record);
  }
  console.log('✅ parseBinary with worker succeeded');
  console.log('Records:', records);
} catch (error) {
  console.error('❌ parseBinary with worker failed:', error.message);
}

console.log('\n=== Testing parseStringStream with worker ===');
try {
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(csv);
      controller.close();
    }
  });

  const records = [];
  const result = parseStringStream(stream, { execution: ['worker'] });
  const iterator = result instanceof Promise ? await result : result;
  for await (const record of iterator) {
    records.push(record);
  }
  console.log('✅ parseStringStream with worker succeeded');
  console.log('Records:', records);
} catch (error) {
  console.error('❌ parseStringStream with worker failed:', error.message);
}

console.log('\n=== Testing parseUint8ArrayStream with worker ===');
try {
  // Recreate csvBinary as it may have been detached in previous tests
  const csvBinaryForStream = new TextEncoder().encode(csv);
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(csvBinaryForStream);
      controller.close();
    }
  });

  const records = [];
  const result = parseUint8ArrayStream(stream, { execution: ['worker'] });
  const iterator = result instanceof Promise ? await result : result;
  for await (const record of iterator) {
    records.push(record);
  }
  console.log('✅ parseUint8ArrayStream with worker succeeded');
  console.log('Records:', records);
} catch (error) {
  console.error('❌ parseUint8ArrayStream with worker failed:', error.message);
}

console.log('\n=== Comparing main vs worker results ===');
try {
  const mainRecords = [];
  for await (const record of parseString(csv, { execution: [] })) {
    mainRecords.push(record);
  }

  const workerRecords = [];
  for await (const record of parseString(csv, { execution: ['worker'] })) {
    workerRecords.push(record);
  }

  const isEqual = JSON.stringify(mainRecords) === JSON.stringify(workerRecords);
  if (isEqual) {
    console.log('✅ Main and worker produce identical results');
  } else {
    console.error('❌ Main and worker produce different results');
    console.log('Main:', mainRecords);
    console.log('Worker:', workerRecords);
  }
} catch (error) {
  console.error('❌ Comparison failed:', error.message);
}

console.log('\n=== All tests completed ===');
process.exit(0);
