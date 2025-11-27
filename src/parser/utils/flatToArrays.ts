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

  const records: CSVArrayRecord<Header>[] = [];

  for (let r = 0; r < recordCount; r++) {
    // Get actual field count for this record.
    // Fields beyond actualCount are undefined (sparse record handling).
    // If actualFieldCounts is not provided, assume all fields are present.
    const actualCount = actualFieldCounts?.[r] ?? fieldCount;

    const arr: (string | undefined)[] = [];
    for (let f = 0; f < fieldCount; f++) {
      // Determine field value: present fields get their value, missing fields are undefined
      const value = f < actualCount ? fieldData[r * fieldCount + f] : undefined;
      arr.push(value);
    }
    records.push(arr as unknown as CSVArrayRecord<Header>);
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
