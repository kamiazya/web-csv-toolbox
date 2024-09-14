import type { ParseBinaryOptions } from "@web-csv-toolbox/common";
import { parseMime } from "@web-csv-toolbox/shared";

/**
 * Extracts the options from the response object.
 *
 * @param response - The response object from which to extract the options.
 * @param options - The options to merge with the extracted options.
 * @returns The options extracted from the response.
 * @throws {RangeError} - The content type is not supported.
 */
export function getOptionsFromResponse<Header extends ReadonlyArray<string>>(
  response: Response,
  options: ParseBinaryOptions<Header> = {},
): ParseBinaryOptions<Header> {
  const { headers } = response;
  const contentType = headers.get("content-type")!;
  const mime = parseMime(contentType);
  if (mime.type !== "text/csv") {
    throw new RangeError(`Invalid mime type: "${contentType}"`);
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
