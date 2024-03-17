import fs from "node:fs/promises";
import { createReadStream } from "node:fs";
import { Readable } from "node:stream";
import path from "node:path";

const filePath = path.resolve(import.meta.dirname, "data/large-dataset.csv");

export async function getAsString() {
  return await fs.readFile(filePath, "utf-8");
}

export async function getAsBinary() {
  return (await fs.readFile(filePath)).buffer;
}

export async function getAsBinaryStream() {
  return Readable.toWeb(createReadStream(filePath, 'binary'));
}
