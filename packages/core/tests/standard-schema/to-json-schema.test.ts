import * as v from "valibot";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { toJsonSchema } from "../../src/standard-schema/index.js";

describe("toJsonSchema", () => {
  const schema = z.object({
    city: z.string(),
    units: z.enum(["c", "f"]).default("c"),
  });

  it("emits draft-07 JSON Schema and omits a defaulted field from required when io is input", () => {
    const result = toJsonSchema(schema, "input");
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.data.$schema).toBe("http://json-schema.org/draft-07/schema#");
    expect(result.data.type).toBe("object");
    expect(result.data.required).toEqual(["city"]);
    expect(result.data.properties).toMatchObject({
      city: { type: "string" },
      units: { type: "string", enum: ["c", "f"], default: "c" },
    });
  });

  it("includes a defaulted field in required when io is output", () => {
    const result = toJsonSchema(schema, "output");
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.data.$schema).toBe("http://json-schema.org/draft-07/schema#");
    expect(result.data.required).toEqual(["city", "units"]);
    expect(result.data.additionalProperties).toBe(false);
  });

  it("returns a clear error, without throwing, when a Zod date cannot be represented", () => {
    expect(() => toJsonSchema(z.date(), "output")).not.toThrow();
    const result = toJsonSchema(z.date(), "output");
    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }
    expect(result.errors[0]).toMatch(/date/i);
    expect(result.errors[0]).toMatch(/cannot convert schema to json schema/i);
  });

  it("returns a clear error when the schema has no Standard JSON Schema converter", () => {
    const valibotSchema = v.object({ city: v.string() });
    expect(() => toJsonSchema(valibotSchema, "input")).not.toThrow();
    const result = toJsonSchema(valibotSchema, "input");
    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }
    expect(result.errors[0]).toMatch(/jsonSchema|standard json schema|not support/i);
  });
});
