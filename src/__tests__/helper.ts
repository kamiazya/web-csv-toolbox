import fc from "fast-check";
import { CRLF, LF } from "../common/constants.js";

export async function transform<I, O, T extends TransformStream<I, O>>(
  transformer: T,
  inputs: I[],
) {
  const rows: any[] = [];
  await new ReadableStream({
    start(controller) {
      if (inputs.length === 0) {
        controller.close();
        return;
      }
      controller.enqueue(inputs.shift());
    },
    pull(controller) {
      if (inputs.length === 0) {
        controller.close();
        return;
      }
      controller.enqueue(inputs.shift());
    },
  })
    .pipeThrough(transformer)
    .pipeTo(
      new WritableStream({
        write(chunk) {
          rows.push(chunk);
        },
      }),
    );
  return rows;
}
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

  export type StringKind =
    | "hexa"
    | "string"
    | "ascii"
    | "unicode"
    | "fullUnicode"
    | "string16bits";
  export const stringKinds: StringKind[] = [
    "hexa",
    "string",
    "ascii",
    "unicode",
    "fullUnicode",
    "string16bits",
  ];

  export function kind(): fc.Arbitrary<StringKind> {
    return fc.constantFrom(...stringKinds);
  }

  export interface CustomStringConstraints extends fc.StringSharedConstraints {
    kind?: StringKind;
  }

  export function string({
    kind = "string",
    ...constraints
  }: CustomStringConstraints = {}): fc.Arbitrary<string> {
    switch (kind) {
      case "hexa":
        return fc.hexaString(constraints);
      case "string":
        return fc.string(constraints);
      case "ascii":
        return fc.asciiString(constraints);
      case "unicode":
        return fc.unicodeString(constraints);
      case "fullUnicode":
        return fc.fullUnicodeString(constraints);
      case "string16bits":
        return fc.string16bits(constraints);
    }
  }

  export interface FieldConstraints extends CustomStringConstraints {
    excludes?: string[];
  }

  export function field({
    excludes = [],
    minLength = 0,
    ...constraints
  }: FieldConstraints = {}): fc.Arbitrary<string> {
    return string({ minLength, ...constraints }).filter(
      _excludeFilter(excludes),
    );
  }

  export interface DemiliterConstraints extends CustomStringConstraints {
    excludes?: string[];
  }
  export function demiliter({
    excludes = [],
    ...constraints
  }: DemiliterConstraints = {}): fc.Arbitrary<string> {
    return string({
      minLength: 1,
      ...constraints,
    }).filter(_excludeFilter(excludes));
  }

  export interface QuoteCharConstraints extends CustomStringConstraints {
    excludes?: string[];
  }

  export function quotation({
    excludes = [],
    ...constraints
  }: QuoteCharConstraints = {}) {
    return string({
      ...constraints,
      minLength: 1,
    }).filter(_excludeFilter(excludes));
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
