import fc from "fast-check";
import { CRLF, LF } from "../common/constants";

export namespace FC {
  function _excludeFilter(excludes: string[]) {
    return (v: string) => {
      for (const exclude of excludes) {
        if (v.includes(exclude)) {
          return false;
        }
      }
      return true;
    };
  }

  export interface FieldConstraints {
    excludes?: string[];
    minLength?: number;
  }
  export function field({
    excludes = [],
    minLength = 0,
  }: FieldConstraints = {}): fc.Arbitrary<string> {
    return fc.string({ minLength }).filter(_excludeFilter(excludes));
  }

  export interface DemiliterConstraints {
    excludes?: string[];
  }
  export function demiliter({
    excludes = [],
  }: DemiliterConstraints = {}): fc.Arbitrary<string> {
    return fc.char().filter(_excludeFilter(excludes));
  }

  export interface QuoteCharConstraints {
    excludes?: string[];
  }

  export function quoteChar({ excludes = [] }: QuoteCharConstraints = {}) {
    return fc.char().filter(_excludeFilter(excludes));
  }

  export function eol() {
    return fc.constantFrom(LF, CRLF);
  }

  export interface RowConstraints {
    sparse?: boolean;
    columnsConstraints?: fc.ArrayConstraints;
    fieldConstraints?: FieldConstraints;
  }
  export function row({
    sparse = false,
    fieldConstraints,
    columnsConstraints,
  }: RowConstraints = {}) {
    return (sparse ? fc.sparseArray : fc.array)(
      field(fieldConstraints),
      columnsConstraints,
    );
  }

  export interface CSVDataConstraints extends RowConstraints {
    rowsConstraints?: fc.ArrayConstraints;
  }

  export function csvData({
    rowsConstraints,
    columnsConstraints,
    fieldConstraints,
  }: CSVDataConstraints) {
    return fc.array(
      row({ columnsConstraints, fieldConstraints }),
      rowsConstraints,
    );
  }

  export type CSVConstraints =
    | HeaderPresentedCSVConstraints
    | HeaderAnsentedCSVConstraints;

  export interface HeaderPresentedCSVConstraints extends CSVDataConstraints {
    header: string[];
  }

  export interface HeaderAnsentedCSVConstraints extends CSVDataConstraints {
    columns: number;
  }

  export function csv({
    fieldConstraints,
    rowsConstraints,
    columnsConstraints,
    ...restConstraints
  }: CSVConstraints) {
    const columns =
      "columns" in restConstraints
        ? restConstraints.columns
        : restConstraints.header.length;
    const header = "header" in restConstraints ? restConstraints.header : [];
    return fc.gen().chain((g) => {
      const d = g(demiliter);
      const EOL = g(eol);
      const data = g(() =>
        csvData({
          columnsConstraints: {
            ...columnsConstraints,
            minLength: columns,
            maxLength: columns,
          },
          fieldConstraints,
          rowsConstraints,
        }),
      );
      return fc.constant(
        [
          ...(header.length ? [header] : []), // header
          ...data, // data
        ]
          .map((row) => row.join(d))
          .join(EOL),
      );
    });
  }
}

export function autoChunk(
  gen: fc.GeneratorValue,
  value: string,
  minLength = 0,
) {
  const chunks: string[] = [];
  for (let cur = 0; cur < value.length; ) {
    const next = gen(fc.integer, {
      min: cur + minLength,
      max: value.length,
    });
    chunks.push(value.slice(cur, next));
    cur = next;
  }
  return chunks;
}

export function chunker(
  gen: fc.GeneratorValue,
  minLenght?: number,
): (
  template: { raw: readonly string[] | ArrayLike<string> },
  ...substitutions: any[]
) => string[] {
  return (template, ...substitutions) =>
    autoChunk(gen, String.raw(template, ...substitutions), minLenght);
}
