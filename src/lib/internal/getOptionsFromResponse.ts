import { ParseBinaryOptions } from "../common/types.ts";
import { parseMime } from "./parseMime.ts";

export function getOptionsFromResponse<Header extends ReadonlyArray<string>>(
  response: Response,
  options: ParseBinaryOptions<Header> = {},
): ParseBinaryOptions<Header> {
  const { headers } = response;
  const contentType = headers.get("content-type") ?? "text/csv";
  const mime = parseMime(contentType);
  if (mime.type !== "text/csv") {
    throw new Error(`Invalid mime type: ${contentType}`);
  }
  const decomposition =
    (headers.get("content-encoding") as CompressionFormat) ?? undefined;
  const charset = mime.parameters.charset ?? "utf-8";
  // TODO: Support header=present and header=absent
  // const header = mime.parameters.header ?? "present";
  return {
    decomposition,
    charset,
    ...options,
  };
}
