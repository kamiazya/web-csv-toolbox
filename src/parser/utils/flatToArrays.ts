import type { FlatParseResult } from "web-csv-toolbox-wasm";
import type { CSVArrayRecord } from "@/core/types.ts";
import type { FlatDataInput } from "./flatToObjects.ts";

/**
 * Convert flat parse data to array records.
 *
 * This is the centralized JS-side assembly from WASM's intermediate flat format
 * for array output. Similar to `flatToObjects`, but produces arrays instead of objects.
 *
 * **Sparse Record Handling:**
 *
 * When a CSV record has fewer fields than the header row, the missing fields
 * are `undefined`, not empty string. The `actualFieldCounts` array tracks
 * how many fields each record actually contains.
 *
 * **Performance Optimizations:**
 *
 * 1. Pre-allocates result array to avoid dynamic resizing
 * 2. Pre-computes row offset to avoid repeated multiplication
 * 3. Uses direct index assignment instead of push()
 * 4. Fast path for non-sparse records (skips actualFieldCounts checks)
 *
 * @template Header - Array of header field names
 * @param data - Flat parse data from WASM or internal processing
 * @returns Array of array records
 *
 * @example
 * ```typescript
 * const flatData = {
 *   headers: ["id", "name"],
 *   fieldData: ["1", "Alice", "2", "Bob"],
 *   actualFieldCounts: [2, 2],
 *   recordCount: 2,
 *   fieldCount: 2,
 * };
 *
 * const records = flatToArrays(flatData);
 * // [["1", "Alice"], ["2", "Bob"]]
 * ```
 *
 * @internal
 */
export function flatToArrays<
  Header extends ReadonlyArray<string> = readonly string[],
>(data: FlatDataInput): CSVArrayRecord<Header>[] {
  const { headers, fieldData, actualFieldCounts, recordCount, fieldCount } =
    data;

  if (!headers || recordCount === 0) {
    return [];
  }

  // Pre-allocate result array for better memory efficiency
  const records: CSVArrayRecord<Header>[] = new Array(recordCount);

  // Determine if we have sparse records (records with fewer fields than header)
  // Fast path: if no actualFieldCounts or all counts equal fieldCount, skip per-field checks
  const hasSparseRecords =
    actualFieldCounts?.some((count) => count !== fieldCount) ?? false;

  if (!hasSparseRecords) {
    // Fast path: all records have complete fields
    for (let r = 0; r < recordCount; r++) {
      const rowOffset = r * fieldCount;
      // Pre-allocate row array
      const arr: string[] = new Array(fieldCount);
      for (let f = 0; f < fieldCount; f++) {
        // Type assertion: we're iterating within valid bounds (f < fieldCount)
        arr[f] = fieldData[rowOffset + f] as string;
      }
      records[r] = arr as unknown as CSVArrayRecord<Header>;
    }
  } else {
    // Slow path: handle sparse records with per-field actualCount checks
    for (let r = 0; r < recordCount; r++) {
      const rowOffset = r * fieldCount;
      // actualFieldCounts is guaranteed non-null in this branch, fallback is defensive
      const actualCount = actualFieldCounts![r] ?? fieldCount;
      // Pre-allocate row array
      const arr: (string | undefined)[] = new Array(fieldCount);
      for (let f = 0; f < fieldCount; f++) {
        // Fields beyond actualCount are undefined (sparse record)
        arr[f] = f < actualCount ? fieldData[rowOffset + f] : undefined;
      }
      records[r] = arr as unknown as CSVArrayRecord<Header>;
    }
  }

  return records;
}

/**
 * Convert WASM FlatParseResult directly to array records.
 *
 * This is a thin wrapper around `flatToArrays` that extracts data from
 * the WASM `FlatParseResult` type, eliminating type casting at call sites.
 *
 * @template Header - Array of header field names
 * @param result - FlatParseResult from WASM parser
 * @returns Array of array records
 *
 * @internal
 */
export function fromFlatParseResultToArrays<
  Header extends ReadonlyArray<string> = readonly string[],
>(result: FlatParseResult): CSVArrayRecord<Header>[] {
  return flatToArrays<Header>({
    headers: result.headers as string[] | null,
    fieldData: result.fieldData as string[],
    actualFieldCounts: result.actualFieldCounts as number[] | null,
    recordCount: result.recordCount,
    fieldCount: result.fieldCount,
  });
}
