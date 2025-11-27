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
 * Uses `Object.fromEntries()` for safe object construction, which is inherently
 * immune to prototype pollution attacks. Unlike direct property assignment
 * (e.g., `obj[key] = value`), `Object.fromEntries()` treats all keys as data
 * properties, including `__proto__`, `constructor`, and `prototype`.
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

  const records: CSVObjectRecord<Header>[] = [];

  for (let r = 0; r < recordCount; r++) {
    // Get actual field count for this record.
    // Fields beyond actualCount are undefined (sparse record handling).
    // If actualFieldCounts is not provided, assume all fields are present.
    const actualCount = actualFieldCounts?.[r] ?? fieldCount;

    // Build entries array for Object.fromEntries
    // This is inherently safe from prototype pollution
    const entries: [string, string | undefined][] = [];
    for (let f = 0; f < fieldCount; f++) {
      const headerKey = headers[f];
      if (headerKey !== undefined) {
        // Determine field value: present fields get their value, missing fields are undefined
        const value =
          f < actualCount ? fieldData[r * fieldCount + f] : undefined;
        entries.push([headerKey, value]);
      }
    }

    records.push(Object.fromEntries(entries) as CSVObjectRecord<Header>);
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
