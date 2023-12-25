import fc from "fast-check";
import { CRLF, LF } from "../internal/constants.js";

export async function transform<I, O, T extends TransformStream<I, O>>(
  transformer: T,
  inputs: I[],
) {
  const copy = [...inputs];
  const rows: any[] = [];
  await new ReadableStream({
    start(controller) {
      if (copy.length === 0) {
        controller.close();
        return;
      }
      controller.enqueue(copy.shift());
    },
    pull(controller) {
      if (copy.length === 0) {
        controller.close();
        return;
      }
      controller.enqueue(copy.shift());
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

  export interface TextConstraints extends fc.StringSharedConstraints {
    kindExcludes?: readonly StringKind[];
  }

  export function text({
    kindExcludes = [],
    ...constraints
  }: TextConstraints = {}): fc.Arbitrary<string> {
    return fc
      .constantFrom(
        ...([
          "hexa",
          "string",
          "ascii",
          "unicode",
          "fullUnicode",
          "string16bits",
        ] as const),
      )
      .filter((v) => !kindExcludes.includes(v))
      .chain((kind) => {
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
      });
  }

  export interface FieldConstraints extends TextConstraints {
    excludes?: string[];
  }

  export function field({
    excludes = [],
    minLength = 0,
    ...constraints
  }: FieldConstraints = {}): fc.Arbitrary<string> {
    return text({ minLength, ...constraints }).filter(_excludeFilter(excludes));
  }

  export interface DemiliterConstraints extends TextConstraints {
    excludes?: string[];
  }
  export function demiliter({
    excludes = [],
    ...constraints
  }: DemiliterConstraints = {}): fc.Arbitrary<string> {
    return text({
      minLength: 1,
      ...constraints,
    })
      .filter(_excludeFilter([...CRLF]))
      .filter(_excludeFilter(excludes));
  }

  export interface QuoteCharConstraints extends TextConstraints {
    excludes?: string[];
  }

  export function quotation({
    excludes = [],
    ...constraints
  }: QuoteCharConstraints = {}) {
    return text({
      ...constraints,
      minLength: 1,
    })
      .filter(_excludeFilter([...CRLF]))
      .filter(_excludeFilter(excludes));
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

  export function header({
    fieldConstraints,
    columnsConstraints,
  }: RowConstraints = {}) {
    return fc.uniqueArray(
      field({
        minLength: 1,
        ...fieldConstraints,
      }),
      {
        minLength: 1,
        ...columnsConstraints,
      },
    );
  }

  export interface CSVDataConstraints extends RowConstraints {
    rowsConstraints?: fc.ArrayConstraints;
  }

  export function csvData({
    rowsConstraints,
    columnsConstraints,
    fieldConstraints,
  }: CSVDataConstraints = {}) {
    return fc.array(
      row({ columnsConstraints, fieldConstraints }),
      rowsConstraints,
    );
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
