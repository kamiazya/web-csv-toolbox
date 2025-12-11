import { scanCsvUtf16ZeroCopy } from "@/wasm/WasmInstance.main.web.ts";

export interface Utf16ScanResult {
  readonly separators: Uint32Array;
  readonly sepCount: number;
  readonly processedChars: number;
  readonly processedSepCount: number;
  readonly endInQuote: boolean;
  readonly endCharOffset: number;
}

/**
 * Convert a JS string into UTF-16 code units and scan via Wasm helper.
 */
export function scanUtf16StreamingChunk(
  chunk: string,
  delimiterCode: number,
  quotationCode: number,
  prevInQuote: boolean,
): Utf16ScanResult {
  if (chunk.length === 0) {
    return {
      separators: new Uint32Array(0),
      sepCount: 0,
      processedChars: 0,
      processedSepCount: 0,
      endInQuote: prevInQuote,
      endCharOffset: 0,
    };
  }

  const utf16 = stringToUint16Array(chunk);
  const wasmView = scanCsvUtf16ZeroCopy(utf16, delimiterCode);
  const separators = copyUint32Array(wasmView);
  const sepCount = separators.length;
  const { processedChars, processedSepCount } = findProcessedRegion(separators);
  const endCharOffset = chunk.length;
  const endInQuote = computeQuoteState(chunk, quotationCode, prevInQuote);
  return {
    separators,
    sepCount,
    processedChars,
    processedSepCount,
    endInQuote,
    endCharOffset,
  };
}

export function ensureTrailingLineFeed(
  separators: Uint32Array,
  sepCount: number,
  sliceLength: number,
): { separators: Uint32Array; sepCount: number } {
  if (sepCount > 0) {
    const last = separators[sepCount - 1]!;
    const lastType = last >>> 31;
    const lastOffset = last & 0x7fffffff;
    if (lastType === 1 && lastOffset + 1 === sliceLength) {
      return {
        separators: separators.subarray(0, sepCount),
        sepCount,
      };
    }
  }

  const extended = new Uint32Array(sepCount + 1);
  if (sepCount > 0) {
    extended.set(separators.subarray(0, sepCount));
  }
  extended[sepCount] = (sliceLength & 0x7fffffff) | 0x80000000;
  return {
    separators: extended,
    sepCount: sepCount + 1,
  };
}

function stringToUint16Array(source: string): Uint16Array {
  const view = new Uint16Array(source.length);
  for (let i = 0; i < source.length; i++) {
    view[i] = source.charCodeAt(i);
  }
  return view;
}

function copyUint32Array(view: Uint32Array): Uint32Array {
  const copy = new Uint32Array(view.length);
  copy.set(view);
  return copy;
}

function findProcessedRegion(separators: Uint32Array): {
  processedChars: number;
  processedSepCount: number;
} {
  for (let i = separators.length - 1; i >= 0; i--) {
    const packed = separators[i]!;
    const sepType = packed >>> 31;
    if (sepType === 1) {
      const offset = packed & 0x7fffffff;
      return { processedChars: offset + 1, processedSepCount: i + 1 };
    }
  }
  return { processedChars: 0, processedSepCount: 0 };
}

function computeQuoteState(
  chunk: string,
  quotationCode: number,
  initialState: boolean,
): boolean {
  let inQuote = initialState;
  for (let i = 0; i < chunk.length; i++) {
    if (chunk.charCodeAt(i) !== quotationCode) {
      continue;
    }
    if (
      inQuote &&
      i + 1 < chunk.length &&
      chunk.charCodeAt(i + 1) === quotationCode
    ) {
      i++; // Escaped quote ("")
      continue;
    }
    inQuote = !inQuote;
  }
  return inQuote;
}
