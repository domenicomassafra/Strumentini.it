export type JsonValidation =
  | { valid: true }
  | { valid: false; code: "INVALID_JSON" };

export function validateJson(input: string): JsonValidation {
  try {
    JSON.parse(input);
    return { valid: true };
  } catch {
    return { valid: false, code: "INVALID_JSON" };
  }
}

export function formatJson(input: string, indent = 2): string {
  if (!Number.isInteger(indent) || indent < 0 || indent > 10) {
    throw new Error("INVALID_INDENT");
  }
  try {
    const value: unknown = JSON.parse(input);
    const formatted = JSON.stringify(value, null, indent);
    if (formatted === undefined) throw new Error("INVALID_JSON");
    return formatted;
  } catch {
    throw new Error("INVALID_JSON");
  }
}
