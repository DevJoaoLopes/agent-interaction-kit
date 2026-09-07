const UNSUPPORTED_KEYWORDS = [
  "not",
  "patternProperties",
  "oneOf",
  "anyOf",
  "allOf",
  "$ref",
] as const;

export function findUnsupportedConstruct(schema: unknown, currentPath = ""): string | null {
  if (!schema || typeof schema !== "object") {
    return null;
  }

  const obj = schema as Record<string, unknown>;
  for (const keyword of UNSUPPORTED_KEYWORDS) {
    if (keyword in obj) {
      return `${currentPath}/${keyword}`;
    }
  }

  if (obj.properties && typeof obj.properties === "object") {
    for (const [propName, propSchema] of Object.entries(obj.properties)) {
      const found = findUnsupportedConstruct(propSchema, `${currentPath}/properties/${propName}`);
      if (found) {
        return found;
      }
    }
  }

  if (obj.items && typeof obj.items === "object") {
    const found = findUnsupportedConstruct(obj.items, `${currentPath}/items`);
    if (found) {
      return found;
    }
  }

  return null;
}
