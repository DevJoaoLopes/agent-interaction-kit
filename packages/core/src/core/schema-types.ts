/**
 * Normalizes a JSON Schema `type` value (a string or an array of strings)
 * to a comparable set. `["object","null"]` and `["null","object"]` are the same type.
 */
function normalizeSchemaType(type: unknown): Set<string> | undefined {
  if (typeof type === "string") {
    return new Set([type]);
  }
  if (Array.isArray(type) && type.length > 0 && type.every((item) => typeof item === "string")) {
    return new Set(type);
  }
  return undefined;
}

export function schemaTypesEqual(left: unknown, right: unknown): boolean {
  const leftTypes = normalizeSchemaType(left);
  const rightTypes = normalizeSchemaType(right);
  if (!leftTypes || !rightTypes) {
    return false;
  }
  if (leftTypes.size !== rightTypes.size) {
    return false;
  }
  for (const item of leftTypes) {
    if (!rightTypes.has(item)) {
      return false;
    }
  }
  return true;
}
