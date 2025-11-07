export interface ParseMimeResult {
  type: string;
  parameters: {
    [key: string]: string;
  };
}

export function parseMime(contentType: string) {
  const [type, ...parameters] = contentType.split(";");
  if (type === undefined) {
    throw new Error("Invalid content type");
  }
  const trimmedType = type.trim();
  if (trimmedType === "") {
    throw new Error("Invalid content type");
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
