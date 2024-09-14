export interface ParseMimeResult {
  type: string;
  parameters: {
    [key: string]: string;
  };
}

export function parseMime(contentType: string): ParseMimeResult {
  const [type, ...parameters] = contentType.split(";");
  const result: ParseMimeResult = {
    type: type.trim(),
    parameters: {},
  };
  for (const paramator of parameters) {
    const [key, value] = paramator.split("=");
    result.parameters[key.trim()] = value.trim();
  }
  return result;
}
