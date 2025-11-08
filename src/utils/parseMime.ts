export interface ParseMimeResult {
  type: string;
  parameters: {
    [key: string]: string;
  };
}

/**
 * Parses a MIME type string into its components.
 *
 * @param contentType - The MIME type string to parse (e.g., "text/csv; charset=utf-8")
 * @returns An object containing the type and parameters
 * @throws {TypeError} When the content type is empty or invalid
 */
export function parseMime(contentType: string) {
  const parts = contentType.split(";");
  // split() always returns at least one element, so parts[0] is guaranteed to be a string
  const type = parts[0]!;
  const parameters = parts.slice(1);
  const trimmedType = type.trim();
  if (trimmedType === "") {
    throw new TypeError("Invalid content type");
  }
  const result: ParseMimeResult = {
    type: trimmedType,
    parameters: {},
  };
  for (const paramator of parameters) {
    const [key, value] = paramator.split("=");
    // Skip parameters without values or keys to prevent undefined.trim() errors
    if (key !== undefined && value !== undefined) {
      const trimmedKey = key.trim();
      const trimmedValue = value.trim();
      // Skip empty keys
      if (trimmedKey !== "") {
        result.parameters[trimmedKey] = trimmedValue;
      }
    }
  }
  return result;
}
