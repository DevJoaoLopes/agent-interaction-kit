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

export function schemaHasType(type: unknown, wanted: string): boolean {
  const types = normalizeSchemaType(type);
  return !!types && types.has(wanted);
}

function jsonValuesEqual(left: unknown, right: unknown): boolean {
  if (Object.is(left, right)) {
    return true;
  }
  if (Array.isArray(left) || Array.isArray(right)) {
    if (!Array.isArray(left) || !Array.isArray(right) || left.length !== right.length) {
      return false;
    }
    return left.every((item, index) => jsonValuesEqual(item, right[index]));
  }
  if (left === null || right === null || typeof left !== "object" || typeof right !== "object") {
    return false;
  }
  const leftRecord = left as Record<string, unknown>;
  const rightRecord = right as Record<string, unknown>;
  const leftKeys = Object.keys(leftRecord);
  const rightKeys = Object.keys(rightRecord);
  if (leftKeys.length !== rightKeys.length) {
    return false;
  }
  return leftKeys.every(
    (key) => Object.hasOwn(rightRecord, key) && jsonValuesEqual(leftRecord[key], rightRecord[key]),
  );
}

/** Covariance: a reader const is only safe if the producer guarantees the same value. */
export function readerConstIsGuaranteed(
  readerSchema: Record<string, unknown>,
  producerSchema: Record<string, unknown>,
): boolean {
  if (!Object.hasOwn(readerSchema, "const")) {
    return true;
  }
  if (!Object.hasOwn(producerSchema, "const")) {
    return false;
  }
  return jsonValuesEqual(readerSchema.const, producerSchema.const);
}
