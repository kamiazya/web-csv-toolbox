export interface ParseMimeResult {
  type: string;
  parameters: {
    [key: string]: string;
  };
}

export function parseMime(contentType: string) {
  const [type, ...parameters] = contentType.split(";");
  const result: ParseMimeResult = {
    type: type.trim(),
    parameters: {},
  };
  for (const paramator of parameters) {
    const [key, value] = paramator.split("=");
    // Skip parameters without values to prevent undefined.trim() errors
    if (value !== undefined) {
      result.parameters[key.trim()] = value.trim();
    }
  }
  return result;
}
