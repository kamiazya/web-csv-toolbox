import type { FlatParseResult } from "web-csv-toolbox-wasm";
import type { CSVObjectRecord } from "@/core/types.ts";

/**
 * Input data structure for flat-to-object conversion.
 * This matches both FlatParseData (internal) and FlatParseResult (WASM).
 *
 * @internal
 */
export interface FlatDataInput {
  /** Parsed header row, or null if not yet determined */
  headers: readonly string[] | null;
  /** All field values in flat array (row-major order) */
  fieldData: readonly string[];
  /** Actual field count per record (for sparse record handling) */
  actualFieldCounts?: readonly number[] | null;
  /** Number of records parsed */
  recordCount: number;
  /** Number of fields per record (header column count) */
  fieldCount: number;
}

/**
 * Convert flat parse data to object records.
 *
 * This is the centralized JS-side assembly from WASM's intermediate flat format.
 * By consolidating this logic in one place, we ensure consistent behavior across
 * all parser types and prevent bugs from duplicated implementations.
 *
 * **Design Philosophy:**
 *
 * The flat data format (headers[], fieldData[], fieldCount, recordCount) is
 * optimized for WASM↔JS boundary crossing efficiency. Object construction
 * is deferred to JavaScript because:
 *
 * 1. **Boundary crossing cost**: Each WASM→JS value transfer has overhead.
 *    Traditional approach: N records × M fields = N×M crossings
 *    Flat approach: ~3-4 crossings (headers, fieldData, counts arrays)
 *
 * 2. **Memory allocation**: JS engines are optimized for object creation.
 *    Creating objects in JS avoids WASM→JS object marshaling overhead.
 *
 * **Sparse Record Handling:**
 *
 * When a CSV record has fewer fields than the header row, the missing fields
 * should be `undefined`, not empty string. The `actualFieldCounts` array
 * tracks how many fields each record actually contains.
 *
 * Example:
 * ```
 * a,b,c
 * 1,2      <- actualFieldCounts[0] = 2, field 'c' is undefined
 * 4,5,6    <- actualFieldCounts[1] = 3, all fields present
 * ```
 *
 * **Security:**
 *
 * Uses `Object.create(null)` for safe object construction, which creates
 * objects without a prototype chain. This is immune to prototype pollution
 * attacks because keys like `__proto__`, `constructor`, and `prototype`
 * become regular data properties, not prototype accessors.
 *
 * **Performance Optimizations:**
 *
 * 1. Pre-allocates result array to avoid dynamic resizing
 * 2. Pre-computes row offset to avoid repeated multiplication
 * 3. Uses direct property assignment instead of Object.fromEntries()
 * 4. Fast path for non-sparse records (skips actualFieldCounts checks)
 *
 * @template Header - Array of header field names
 * @param data - Flat parse data from WASM or internal processing
 * @returns Array of object records
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
 * const records = flatToObjects(flatData);
 * // [{ id: "1", name: "Alice" }, { id: "2", name: "Bob" }]
 * ```
 *
 * @internal
 */
export function flatToObjects<
  Header extends ReadonlyArray<string> = readonly string[],
>(data: FlatDataInput): CSVObjectRecord<Header>[] {
  const { headers, fieldData, actualFieldCounts, recordCount, fieldCount } =
    data;

  if (!headers || recordCount === 0) {
    return [];
  }

  // Pre-allocate result array for better memory efficiency
  const records: CSVObjectRecord<Header>[] = new Array(recordCount);

  // Determine if we have sparse records (records with fewer fields than header)
  // Fast path: if no actualFieldCounts or all counts equal fieldCount, skip per-field checks
  const hasSparseRecords =
    actualFieldCounts?.some((count) => count !== fieldCount) ?? false;

  if (!hasSparseRecords) {
    // Fast path: all records have complete fields
    for (let r = 0; r < recordCount; r++) {
      const rowOffset = r * fieldCount;
      // Object.create(null) creates prototype-less object (safe from prototype pollution)
      const record: Record<string, string> = Object.create(null);
      for (let f = 0; f < fieldCount; f++) {
        const headerKey = headers[f];
        if (headerKey !== undefined) {
          // Type assertion: we're iterating within valid bounds (f < fieldCount)
          record[headerKey] = fieldData[rowOffset + f] as string;
        }
      }
      records[r] = record as CSVObjectRecord<Header>;
    }
  } else {
    // Slow path: handle sparse records with per-field actualCount checks
    for (let r = 0; r < recordCount; r++) {
      const rowOffset = r * fieldCount;
      // actualFieldCounts is guaranteed non-null in this branch, fallback is defensive
      const actualCount = actualFieldCounts![r] ?? fieldCount;
      // Object.create(null) creates prototype-less object (safe from prototype pollution)
      const record: Record<string, string | undefined> = Object.create(null);
      for (let f = 0; f < fieldCount; f++) {
        const headerKey = headers[f];
        if (headerKey !== undefined) {
          // Fields beyond actualCount are undefined (sparse record)
          record[headerKey] =
            f < actualCount ? fieldData[rowOffset + f] : undefined;
        }
      }
      records[r] = record as CSVObjectRecord<Header>;
    }
  }

  return records;
}

/**
 * Convert WASM FlatParseResult directly to object records.
 *
 * This is a thin wrapper around `flatToObjects` that extracts data from
 * the WASM `FlatParseResult` type, eliminating type casting at call sites.
 *
 * @template Header - Array of header field names
 * @param result - FlatParseResult from WASM parser
 * @returns Array of object records
 *
 * @example
 * ```typescript
 * const flatResult = wasmParser.processChunk(csvData);
 * const records = fromFlatParseResult(flatResult);
 * ```
 *
 * @internal
 */
export function fromFlatParseResult<
  Header extends ReadonlyArray<string> = readonly string[],
>(result: FlatParseResult): CSVObjectRecord<Header>[] {
  return flatToObjects<Header>({
    headers: result.headers as string[] | null,
    fieldData: result.fieldData as string[],
    actualFieldCounts: result.actualFieldCounts as number[] | null,
    recordCount: result.recordCount,
    fieldCount: result.fieldCount,
  });
}
