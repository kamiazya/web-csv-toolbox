export async function toArray<
  O,
  T extends (...args: any[]) => AsyncGenerator<O>,
>(this: T, ...args: Parameters<T>): Promise<O[]> {
  const rows: O[] = [];
  for await (const row of this(...args)) {
    rows.push(row);
  }
  return rows;
}
