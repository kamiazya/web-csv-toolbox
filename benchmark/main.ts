
import { withCodSpeed } from "@codspeed/tinybench-plugin";
import { Bench } from 'tinybench';
import { loadWASM, parseBinary, parseString, parseStringToArraySyncWASM } from 'web-csv-toolbox';

const csv = [
  // header
  'index,"quated",not quated',
  // body
  // e.g.
  // 10,"xxxxxxxxxx",yyyyyyyyyy
  ...new Array(50).map((_,i) => `${i},"${'x'.repeat(i)}",${'y'.repeat(i)}`),
  // for the last line
  ''
].join('\n');

export async function getAsString() {
  return csv;
}

export async function getAsBinary() {
  return new TextEncoder().encode(csv);
}

export async function getAsBinaryStream() {
  return new Blob([csv], { type: 'text/csv' }).stream();
}

await loadWASM();
let binaryCSV: Uint8Array = await getAsBinary()
let stringCSV: string = await getAsString();

const bench = withCodSpeed(new Bench({
  iterations: 50,
}))
  .add('parseString.toArraySync(50 rows)', () => {
    parseString.toArraySync(stringCSV);
  })
  .add('parseStringToArraySyncWASM(50 rows)', () => {
    parseStringToArraySyncWASM(stringCSV);
  })
  .add('parseString.toIterableIterator(50 rows)', async () => {
    for await (const _ of parseString.toIterableIterator(stringCSV)) {
      // noop
    }
  })
  .add('parseString.toStream(50 rows)', async () => {
    await parseString.toStream(stringCSV).pipeTo(new WritableStream({
      write(_) {
        // noop
      }
    }));
  })
  .add('parseBinary.toArraySync(50 rows)', () => {
    parseBinary.toArraySync(binaryCSV);
  })
  .add('parseBinary.toIterableIterator(50 rows)', () => {
    for (const _ of parseBinary.toIterableIterator(binaryCSV)) {
      // noop
    }
  })
  .add('parseBinary.toStream(50 rows)', async () => {
    await parseBinary.toStream(binaryCSV).pipeTo(new WritableStream({
      write(_) {
        // noop
      }
    }));
  });


await bench.warmup();

await bench.run();
console.table(bench.table());
