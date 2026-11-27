import type { StandardJSONSchemaV1 } from "@standard-schema/spec";
import type { Result } from "../contracts/types.js";

export type ToJsonSchemaIo = "input" | "output";

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object";
}

function getConverter(
  schema: unknown,
): { vendor: string; convert: StandardJSONSchemaV1.Converter } | undefined {
  if (!isRecord(schema) || !isRecord(schema["~standard"])) {
    return undefined;
  }
  const standard = schema["~standard"];
  const jsonSchema = standard.jsonSchema;
  if (
    !isRecord(jsonSchema) ||
    typeof jsonSchema.input !== "function" ||
    typeof jsonSchema.output !== "function"
  ) {
    return undefined;
  }
  return {
    vendor: typeof standard.vendor === "string" ? standard.vendor : "unknown",
    convert: jsonSchema as unknown as StandardJSONSchemaV1.Converter,
  };
}

export function toJsonSchema(schema: unknown, io: ToJsonSchemaIo): Result<Record<string, unknown>> {
  const converter = getConverter(schema);
  if (!converter) {
    return {
      ok: false,
      errors: ["Schema does not implement Standard JSON Schema (missing ~standard.jsonSchema)."],
    };
  }
  try {
    const schemaJson = converter.convert[io]({ target: "draft-07" });
    if (!isRecord(schemaJson)) {
      return {
        ok: false,
        errors: [
          `Standard JSON Schema ${io} converter from vendor "${converter.vendor}" did not return an object.`,
        ],
      };
    }
    return { ok: true, data: schemaJson };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      ok: false,
      errors: [
        `Cannot convert schema to JSON Schema (vendor: ${converter.vendor}, io: ${io}): ${message}`,
      ],
    };
  }
}
