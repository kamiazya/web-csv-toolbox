/**
 * Benchmark Data Generator
 *
 * Generates and manages test CSV files for benchmarks.
 * Files are generated on-demand and cached in the data/ directory.
 */

import { createReadStream, createWriteStream, existsSync, statSync } from "node:fs";
import { mkdir, stat } from "node:fs/promises";
import { Readable } from "node:stream";
import path from "node:path";

const DATA_DIR = path.join(import.meta.dirname, "data");

/**
 * Ensure data directory exists
 */
export async function ensureDataDir(): Promise<void> {
  if (!existsSync(DATA_DIR)) {
    await mkdir(DATA_DIR, { recursive: true });
  }
}

/**
 * Get file path for a test dataset
 */
export function getDataPath(name: string): string {
  return path.join(DATA_DIR, `${name}.csv`);
}

/**
 * Check if a file exists and get its size
 */
export async function getFileInfo(filePath: string): Promise<{ exists: boolean; size: number }> {
  try {
    const stats = await stat(filePath);
    return { exists: true, size: stats.size };
  } catch {
    return { exists: false, size: 0 };
  }
}

/**
 * Generate CSV content as a string (for small datasets)
 */
export function generateCSVString(rows: number, cols: number, fieldLength = 10): string {
  const header = Array.from({ length: cols }, (_, i) => `col${i}`).join(",");
  const dataRows = Array.from({ length: rows }, () =>
    Array.from({ length: cols }, () => "x".repeat(fieldLength)).join(",")
  );
  return [header, ...dataRows].join("\n");
}

/**
 * Generate CSV with long quoted fields (tests two-pass algorithm)
 */
export function generateLongQuotedCSVString(rows: number, fieldLength: number): string {
  const header = "id,name,content";
  const dataRows = Array.from(
    { length: rows },
    (_, i) => `${i},"Name${i}","${"a".repeat(fieldLength)}"`
  );
  return [header, ...dataRows].join("\n");
}

/**
 * Generate a large CSV file by streaming
 */
export async function generateLargeCSVFile(
  filePath: string,
  targetSizeMB: number,
  cols: number = 10,
  fieldLength: number = 20
): Promise<void> {
  const targetSize = targetSizeMB * 1024 * 1024;

  // Check if file already exists with correct size (within 5% tolerance)
  const info = await getFileInfo(filePath);
  if (info.exists && Math.abs(info.size - targetSize) / targetSize < 0.05) {
    console.log(`  Using cached file: ${path.basename(filePath)} (${(info.size / 1024 / 1024).toFixed(1)} MB)`);
    return;
  }

  console.log(`  Generating: ${path.basename(filePath)} (~${targetSizeMB} MB)...`);

  const writeStream = createWriteStream(filePath);

  // Write header
  const header = Array.from({ length: cols }, (_, i) => `col${i}`).join(",") + "\n";
  writeStream.write(header);

  let currentSize = header.length;
  let rowCount = 0;

  // Generate row template
  const rowTemplate = Array.from({ length: cols }, () => "x".repeat(fieldLength)).join(",") + "\n";
  const rowSize = rowTemplate.length;

  // Write rows until we reach target size
  return new Promise((resolve, reject) => {
    function writeRows() {
      let ok = true;
      while (currentSize < targetSize && ok) {
        // Replace row content with unique values for more realistic data
        const row = Array.from({ length: cols }, (_, i) =>
          `${rowCount.toString().padStart(fieldLength, "0").slice(0, fieldLength)}`
        ).join(",") + "\n";

        ok = writeStream.write(row);
        currentSize += row.length;
        rowCount++;
      }

      if (currentSize >= targetSize) {
        writeStream.end();
      } else {
        writeStream.once("drain", writeRows);
      }
    }

    writeStream.on("finish", () => {
      console.log(`  Generated: ${path.basename(filePath)} (${(currentSize / 1024 / 1024).toFixed(1)} MB, ${rowCount} rows)`);
      resolve();
    });

    writeStream.on("error", reject);
    writeRows();
  });
}

/**
 * Generate a large CSV file with long quoted fields
 */
export async function generateLargeLongQuotedCSVFile(
  filePath: string,
  targetSizeMB: number,
  quotedFieldLength: number = 500
): Promise<void> {
  const targetSize = targetSizeMB * 1024 * 1024;

  // Check if file already exists with correct size (within 5% tolerance)
  const info = await getFileInfo(filePath);
  if (info.exists && Math.abs(info.size - targetSize) / targetSize < 0.05) {
    console.log(`  Using cached file: ${path.basename(filePath)} (${(info.size / 1024 / 1024).toFixed(1)} MB)`);
    return;
  }

  console.log(`  Generating: ${path.basename(filePath)} (~${targetSizeMB} MB, ${quotedFieldLength}B quoted fields)...`);

  const writeStream = createWriteStream(filePath);

  // Write header
  const header = "id,name,content\n";
  writeStream.write(header);

  let currentSize = header.length;
  let rowCount = 0;

  const quotedContent = "a".repeat(quotedFieldLength);

  return new Promise((resolve, reject) => {
    function writeRows() {
      let ok = true;
      while (currentSize < targetSize && ok) {
        const row = `${rowCount},"Name${rowCount}","${quotedContent}"\n`;
        ok = writeStream.write(row);
        currentSize += row.length;
        rowCount++;
      }

      if (currentSize >= targetSize) {
        writeStream.end();
      } else {
        writeStream.once("drain", writeRows);
      }
    }

    writeStream.on("finish", () => {
      console.log(`  Generated: ${path.basename(filePath)} (${(currentSize / 1024 / 1024).toFixed(1)} MB, ${rowCount} rows)`);
      resolve();
    });

    writeStream.on("error", reject);
    writeRows();
  });
}

/**
 * Create a ReadableStream from a file for binary parsing
 * Uses Node.js Readable.toWeb() for proper stream conversion
 */
export function createBinaryFileStream(filePath: string): ReadableStream<Uint8Array> {
  const nodeStream = createReadStream(filePath);
  return Readable.toWeb(nodeStream) as ReadableStream<Uint8Array>;
}

/**
 * Create a ReadableStream from a file for string parsing
 * Uses Node.js Readable.toWeb() for proper stream conversion
 */
export function createStringFileStream(filePath: string): ReadableStream<string> {
  const nodeStream = createReadStream(filePath, { encoding: "utf-8" });
  return Readable.toWeb(nodeStream) as ReadableStream<string>;
}

/**
 * Read file as Uint8Array (for small/medium files)
 */
export async function readFileAsUint8Array(filePath: string): Promise<Uint8Array> {
  const { readFile } = await import("node:fs/promises");
  const buffer = await readFile(filePath);
  return new Uint8Array(buffer);
}

/**
 * Read file as string (for small/medium files)
 */
export async function readFileAsString(filePath: string): Promise<string> {
  const { readFile } = await import("node:fs/promises");
  return readFile(filePath, "utf-8");
}

/**
 * Get file size in bytes
 */
export function getFileSizeSync(filePath: string): number {
  try {
    return statSync(filePath).size;
  } catch {
    return 0;
  }
}

/**
 * Format file size for display
 */
export function formatSize(bytes: number): string {
  if (bytes >= 1024 * 1024 * 1024) {
    return `${(bytes / 1024 / 1024 / 1024).toFixed(1)} GB`;
  }
  if (bytes >= 1024 * 1024) {
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  }
  if (bytes >= 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }
  return `${bytes} B`;
}
