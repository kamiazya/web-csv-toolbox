/**
 * Convert WebGPU CSVRecord to standard CSVRecord format
 */

import type { CSVRecord } from "@/core/types.ts";
import type { CSVRecord as WebGPUCSVRecord } from "@/parser/webgpu/indexing/types.ts";

/**
 * Convert WebGPU CSVRecord to standard CSVRecord format
 *
 * @param gpuRecord - WebGPU record to convert
 * @param header - Header array for object format
 * @param outputFormat - Output format ('object' or 'array')
 * @returns Standard CSVRecord
 */
export function convertToStandardRecord<Header extends ReadonlyArray<string>>(
  gpuRecord: WebGPUCSVRecord,
  header: Header | undefined,
  outputFormat: "object" | "array" = "object",
): CSVRecord<Header> {
  const values = gpuRecord.fields.map((f) => f.value);

  if (outputFormat === "array") {
    return values as unknown as CSVRecord<Header>;
  }

  // Object format - need header
  if (!header) {
    throw new Error("Header is required for object output format");
  }

  // Use Object.create(null) to avoid prototype pollution issues with special keys like __proto__
  const record: Record<string, string> = Object.create(null);
  for (let i = 0; i < header.length; i++) {
    record[header[i]!] = values[i] ?? "";
  }

  return record as CSVRecord<Header>;
}
