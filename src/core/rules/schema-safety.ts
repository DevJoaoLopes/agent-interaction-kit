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
      const escapedName = propName.replace(/~/g, "~0").replace(/\//g, "~1");
      const found = findUnsupportedConstruct(
        propSchema,
        `${currentPath}/properties/${escapedName}`,
      );
      if (found) {
        return found;
      }
    }
  }

  for (const keyword of ["items", "prefixItems"] as const) {
    const schemas = obj[keyword];
    if (Array.isArray(schemas)) {
      for (const [index, item] of schemas.entries()) {
        const found = findUnsupportedConstruct(item, `${currentPath}/${keyword}/${index}`);
        if (found) return found;
      }
    } else if (keyword === "items") {
      const found = findUnsupportedConstruct(schemas, `${currentPath}/items`);
      if (found) return found;
    }
  }

  if (obj.additionalProperties && typeof obj.additionalProperties === "object") {
    const found = findUnsupportedConstruct(
      obj.additionalProperties,
      `${currentPath}/additionalProperties`,
    );
    if (found) {
      return found;
    }
  }

  return null;
}
