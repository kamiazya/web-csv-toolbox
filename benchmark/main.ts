import fs from "node:fs/promises";
import { createReadStream } from "node:fs";
import { Readable } from "node:stream";

import { Bench } from 'tinybench';
import { withCodSpeed } from "@codspeed/tinybench-plugin";
import { loadWASM, parseBinary, parseString, parseStringToArraySyncWASM } from 'web-csv-toolbox';


const filePath = new URL(import.meta.resolve("./data/large-dataset.csv")).pathname;

export async function getAsString() {
  return await fs.readFile(filePath, "utf-8");
}

export async function getAsBinary() {
  const data = await fs.readFile(filePath);
  return new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
}

export async function getAsBinaryStream() {
  return Readable.toWeb(createReadStream(filePath, 'binary'));
}

await loadWASM();
let binaryCSV: Uint8Array = await getAsBinary()
let stringCSV: string = await getAsString();

const bench = withCodSpeed(new Bench())
  .add('parseString.toArraySync(large-dataset)', () => {
    parseString.toArraySync(stringCSV);
  })
  .add('parseStringToArraySyncWASM(large-dataset)', () => {
    parseStringToArraySyncWASM(stringCSV);
  })
  .add('parseString.toIterableIterator(large-dataset)', async () => {
    for await (const _ of parseString.toIterableIterator(stringCSV)) {
      // noop
    }
  })
  .add('parseString.toStream(large-dataset)', async () => {
    await parseString.toStream(stringCSV).pipeTo(new WritableStream({
      write(_) {
        // noop
      }
    }));
  })
  .add('parseBinary.toArraySync(large-dataset)', () => {
    parseBinary.toArraySync(binaryCSV);
  })
  .add('parseBinary.toIterableIterator(large-dataset)', () => {
    for (const _ of parseBinary.toIterableIterator(binaryCSV)) {
      // noop
    }
  })
  .add('parseBinary.toStream(large-dataset)', async () => {
    await parseBinary.toStream(binaryCSV).pipeTo(new WritableStream({
      write(_) {
        // noop
      }
    }));
  });


await bench.warmup();

await bench.run();
console.table(bench.table());
