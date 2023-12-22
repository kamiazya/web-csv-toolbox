import { CommonOptions } from "./common/types.js";
import { streamingParse } from "./streamingParse.js";
import { ParserOptions } from "./transformers/index.js";

export async function parse<Header extends ReadonlyArray<string>>(
  csv: string,
  options?: CommonOptions & ParserOptions<Header>,
) {
  const rows = [];
  for await (const row of streamingParse(csv, options)) {
    rows.push(row);
  }
  return rows;
}
