import fc from "fast-check";

import { CRLF, LF, assertCommonOptions } from "@web-csv-toolbox/common";

export async function transform<I, O>(
  transformer: TransformStream<I, O>,
  inputs: I[],
): Promise<O[]> {
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

  export interface TextConstraints extends fc.StringConstraints {
    excludes?: string[];
  }

  export function text({
    excludes = [],
    ...constraints
  }: TextConstraints = {}): fc.Arbitrary<string> {
    return fc
      .string({ unit: "grapheme", ...constraints })
      .filter(_excludeFilter(excludes));
  }

  export function field({
    minLength = 0,
    ...constraints
  }: TextConstraints = {}): fc.Arbitrary<string> {
    return (
      text({ minLength, ...constraints })
        // Filter out BOM to ensure clean test data
        .filter((v) => !v.startsWith("\ufeff"))
    );
  }

  export interface DelimiterConstraints extends TextConstraints {
    excludes?: string[];
  }
  export function delimiter(
    options: DelimiterConstraints | string = {},
  ): fc.Arbitrary<string> {
    if (typeof options === "string") {
      return fc.constant(options);
    }
    const { excludes = [], ...constraints }: DelimiterConstraints = options;
    return text({
      ...constraints,
      minLength: 1,
      maxLength: 1,
      unit: "grapheme-composite",
    }).filter(_excludeFilter([...CRLF, ...excludes]));
  }

  export interface QuotationConstraints extends TextConstraints {
    excludes?: string[];
  }

  export function quotation(options: QuotationConstraints | string = {}) {
    if (typeof options === "string") {
      return fc.constant(options);
    }
    const { excludes = [], ...constraints } = options;
    return text({
      ...constraints,
      minLength: 1,
      maxLength: 1,
      unit: "grapheme-composite",
    }).filter(_excludeFilter([...CRLF, ...excludes]));
  }

  export interface CommonOptionsConstraints {
    delimiter?: string | DelimiterConstraints;
    quotation?: string | QuotationConstraints;
  }

  export function commonOptions({
    delimiter,
    quotation,
  }: CommonOptionsConstraints = {}) {
    return fc
      .record({
        delimiter: FC.delimiter(delimiter),
        quotation: FC.quotation(quotation),
      })
      .filter(({ delimiter, quotation }) => {
        try {
          assertCommonOptions({ delimiter, quotation });
          return true;
        } catch {
          return false;
        }
      });
  }

  export function quote() {
    return fc.constantFrom<true | undefined>(true, undefined);
  }

  export function eol() {
    return fc.constantFrom(LF, CRLF);
  }

  export interface RowConstraints {
    sparse?: boolean;
    columnsConstraints?: fc.ArrayConstraints;
    fieldConstraints?: TextConstraints;
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
