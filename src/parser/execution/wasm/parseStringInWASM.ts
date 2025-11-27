import type { CSVArrayRecord, CSVRecord, ParseOptions } from "@/core/types.ts";
import { WASMStringCSVArrayParser } from "@/parser/models/WASMStringCSVArrayParser.ts";
import { WASMStringObjectCSVParser } from "@/parser/models/WASMStringObjectCSVParser.ts";

/**
 * Parse CSV string using WebAssembly in main thread.
 *
 * @internal
 * @param csv - CSV string to parse
 * @param options - Parsing options
 * @returns Async iterable iterator of records
 *
 * @remarks
 * WASM module is automatically initialized on first use if not already loaded.
 * However, it is recommended to call {@link loadWASM} beforehand for better performance.
 *
 * WASM parser has limitations:
 * - Only supports UTF-8 encoding
 * - Only supports single-character delimiter and quotation
 * - Synchronous operation (no streaming)
 */
export async function* parseStringInWASM<Header extends ReadonlyArray<string>>(
  csv: string,
  options?: ParseOptions<Header>,
): AsyncIterableIterator<CSVRecord<Header> | CSVArrayRecord<Header>> {
  const outputFormat = options?.outputFormat ?? "object";

  if (outputFormat === "array") {
    // Use array parser for array output
    const parser = new WASMStringCSVArrayParser<Header>({
      delimiter: options?.delimiter ?? ",",
      quotation: options?.quotation ?? '"',
      maxFieldCount: options?.maxFieldCount,
      header: options?.header,
    });

    for (const record of parser.parse(csv)) {
      yield record;
    }
  } else {
    // Use object parser for object output (default)
    const parser = new WASMStringObjectCSVParser<Header>({
      delimiter: options?.delimiter ?? ",",
      quotation: options?.quotation ?? '"',
      maxFieldCount: options?.maxFieldCount,
      header: options?.header,
    });

    for (const record of parser.parse(csv)) {
      yield record;
    }
  }
}
