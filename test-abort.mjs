import { parseString, terminateWorkers } from './dist/web-csv-toolbox.js';

const csv = `name,age,city
Alice,30,Tokyo
Bob,25,Osaka
Charlie,35,Kyoto`;

console.log('=== Testing AbortSignal with worker ===\n');

// Test 1: Already aborted signal
try {
  const controller = new AbortController();
  controller.abort();

  const records = [];
  for await (const record of parseString(csv, {
    execution: ['worker'],
    signal: controller.signal
  })) {
    records.push(record);
  }

  console.log('❌ Should have thrown AbortError');
} catch (error) {
  if (error.name === 'AbortError') {
    console.log('✅ Already aborted signal handled correctly');
  } else {
    console.log('❌ Wrong error:', error);
  }
}

// Test 2: Abort during parsing (simulate with small delay)
try {
  const controller = new AbortController();

  // Abort after 10ms
  setTimeout(() => {
    console.log('Aborting...');
    controller.abort();
  }, 10);

  const records = [];
  for await (const record of parseString(csv, {
    execution: ['worker'],
    signal: controller.signal
  })) {
    records.push(record);
    // Add a small delay to allow abort to trigger
    await new Promise(resolve => setTimeout(resolve, 5));
  }

  console.log('⚠️  Parsing completed before abort (this is okay for small CSV)');
  console.log('Records:', records.length);
} catch (error) {
  if (error.name === 'AbortError') {
    console.log('✅ Abort during parsing handled correctly');
  } else {
    console.log('❌ Wrong error:', error);
  }
}

// Test 3: Normal parsing with signal (should not abort)
try {
  const controller = new AbortController();

  const records = [];
  for await (const record of parseString(csv, {
    execution: ['worker'],
    signal: controller.signal
  })) {
    records.push(record);
  }

  if (records.length === 3) {
    console.log('✅ Normal parsing with signal works');
  } else {
    console.log('❌ Wrong number of records:', records.length);
  }
} catch (error) {
  console.log('❌ Unexpected error:', error);
}

console.log('\n=== All abort tests completed ===');

// Terminate workers to allow process to exit
terminateWorkers();
console.log('Workers terminated');
