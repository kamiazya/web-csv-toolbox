const csv = [
  // header
  'index,"quated",not quated',
  // body
  // e.g.
  // 10,"xxxxxxxxxx",yyyyyyyyyy
  ...Array.from(
    { length: 50 },
    (_, i) => `${i},"${"x".repeat(i)}",${"y".repeat(i)}`,
  ),
  // for the last line
  "",
].join("\n");

export function getStringCSV(rows: number) {
  return [
    // header
    'index,"quated",not quated',
    // body
    // e.g.
    // 10,"xxxxxxxxxx",yyyyyyyyyy
    ...Array.from(
      { length: rows },
      (_, i) => `${i},"${"x".repeat(i)}",${"y".repeat(i)}`,
    ),
    // for the last line
    "",
  ].join("\n");
}

export function getBinaryCSV(rows: number) {
  return new TextEncoder().encode(getStringCSV(rows));
}

export function getBinaryStreamCSV() {
  return new Blob([csv], { type: "text/csv" }).stream();
}
