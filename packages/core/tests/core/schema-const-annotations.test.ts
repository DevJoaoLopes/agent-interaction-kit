import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import type { ConsumerExpectations, ProviderManifest } from "../../src/contracts/types.js";
import { evaluateCompatibility } from "../../src/core/compatibility.js";

const zodOutputSchema = JSON.parse(
  readFileSync(
    join(dirname(fileURLToPath(import.meta.url)), "fixtures/zod-4.6.7-output.schema.json"),
    "utf8",
  ),
) as Record<string, unknown>;

function pairWithResultSchema(
  providerSchema: Record<string, unknown>,
  consumerSchema: Record<string, unknown> = providerSchema,
): { provider: ProviderManifest; consumer: ConsumerExpectations } {
  return {
    provider: {
      schemaVersion: "1.0.0",
      producer: { name: "backend", version: "1.0.0", buildId: "b1" },
      protocolProfile: "ag-ui@0.1",
      contextProfile: "default",
      tools: [
        {
          name: "w",
          executionSide: "backend",
          parameters: { type: "object", properties: {} },
          returns: { format: "json", schema: providerSchema },
        },
      ],
    },
    consumer: {
      schemaVersion: "1.0.0",
      consumer: { name: "frontend", version: "1.0.0", buildId: "c1" },
      protocolProfile: "ag-ui@0.1",
      contextProfile: "default",
      requires: [
        {
          toolName: "w",
          executionSide: "backend",
          expectedReturns: { format: "json", schema: consumerSchema },
        },
      ],
    },
  };
}

describe("const, $schema and draft 2020-12 annotations", () => {
  it("evaluates a real Zod 4.6.7 JSON Schema fixture without a false positive", () => {
    const { provider, consumer } = pairWithResultSchema(zodOutputSchema);
    const report = evaluateCompatibility(provider, consumer);
    expect(report.status).toBe("pass");
    expect(report.diagnostics).toEqual([]);
  });

  it("allows $schema and draft 2020-12 annotations without AIK-SCHEMA-001", () => {
    const schema = {
      $schema: "https://json-schema.org/draft/2020-12/schema",
      $id: "https://example.com/weather",
      $comment: "generated",
      title: "Weather",
      description: "Current weather",
      deprecated: false,
      readOnly: true,
      writeOnly: false,
      examples: [{ city: "Lisbon" }],
      default: { city: "Lisbon" },
      type: "object",
      properties: {
        city: { type: "string", title: "City", description: "City name", default: "Lisbon" },
      },
      required: ["city"],
    };
    const { provider, consumer } = pairWithResultSchema(schema);
    const report = evaluateCompatibility(provider, consumer);
    expect(report.status).toBe("pass");
    expect(report.diagnostics).toEqual([]);
  });

  it("does not report AIK-SCHEMA-001 for $defs when there is no $ref", () => {
    const schema = {
      type: "object",
      $defs: { city: { type: "string" } },
      properties: { city: { type: "string" } },
      required: ["city"],
    };
    const { provider, consumer } = pairWithResultSchema(schema);
    const report = evaluateCompatibility(provider, consumer);
    expect(report.status).toBe("pass");
    expect(report.diagnostics).toEqual([]);
  });

  it("returns unknown with AIK-SCHEMA-001 when the schema uses a $ref", () => {
    const schema = {
      type: "object",
      $defs: { city: { type: "string" } },
      properties: { city: { $ref: "#/$defs/city" } },
      required: ["city"],
    };
    const { provider, consumer } = pairWithResultSchema(schema);
    const report = evaluateCompatibility(provider, consumer);
    expect(report.status).toBe("unknown");
    const diag = report.diagnostics.find((item) => item.code === "AIK-SCHEMA-001");
    expect(diag).toBeDefined();
    expect(diag?.path).toBe("/returns/schema/properties/city/$ref");
  });

  it("fails when result const values differ", () => {
    const { provider, consumer } = pairWithResultSchema(
      {
        type: "object",
        properties: { status: { type: "string", const: "ok" } },
        required: ["status"],
      },
      {
        type: "object",
        properties: { status: { type: "string", const: "err" } },
        required: ["status"],
      },
    );
    const report = evaluateCompatibility(provider, consumer);
    expect(report.status).toBe("fail");
    const diag = report.diagnostics.find(
      (item) => item.path === "/returns/schema/properties/status/const",
    );
    expect(diag).toBeDefined();
    expect(diag?.expected).toBe("err");
    expect(diag?.actual).toBe("ok");
  });

  it("fails when the consumer requires a const the provider does not guarantee", () => {
    const { provider, consumer } = pairWithResultSchema(
      { type: "object", properties: { status: { type: "string" } }, required: ["status"] },
      {
        type: "object",
        properties: { status: { type: "string", const: "ok" } },
        required: ["status"],
      },
    );
    const report = evaluateCompatibility(provider, consumer);
    expect(report.status).toBe("fail");
    const diag = report.diagnostics.find(
      (item) => item.path === "/returns/schema/properties/status/const",
    );
    expect(diag).toBeDefined();
    expect(diag?.expected).toBe("ok");
  });

  it("passes when the provider const satisfies the consumer const", () => {
    const schema = {
      type: "object",
      properties: { status: { type: "string", const: "ok" } },
      required: ["status"],
    };
    const { provider, consumer } = pairWithResultSchema(schema);
    const report = evaluateCompatibility(provider, consumer);
    expect(report.status).toBe("pass");
    expect(report.diagnostics).toEqual([]);
  });

  it("passes when the provider is a const and the consumer only declares the type", () => {
    const { provider, consumer } = pairWithResultSchema(
      {
        type: "object",
        properties: { status: { type: "string", const: "ok" } },
        required: ["status"],
      },
      { type: "object", properties: { status: { type: "string" } }, required: ["status"] },
    );
    const report = evaluateCompatibility(provider, consumer);
    expect(report.status).toBe("pass");
    expect(report.diagnostics).toEqual([]);
  });
});

describe("const numeric equality", () => {
  it("treats positive and negative zero as the same JSON number", () => {
    const withConst = (value: unknown) => ({
      type: "object",
      properties: { level: { type: "number", const: value } },
      required: ["level"],
    });
    const { provider, consumer } = pairWithResultSchema(withConst(0), withConst(-0));
    expect(evaluateCompatibility(provider, consumer).diagnostics).toEqual([]);
  });

  it("treats zero nested in an object or array const as equal", () => {
    const withConst = (value: unknown) => ({
      type: "object",
      properties: { point: { type: "object", const: value } },
      required: ["point"],
    });
    const { provider, consumer } = pairWithResultSchema(
      withConst({ x: [0, 1] }),
      withConst({ x: [-0, 1] }),
    );
    expect(evaluateCompatibility(provider, consumer).diagnostics).toEqual([]);
  });

  it("still distinguishes different numbers", () => {
    const withConst = (value: unknown) => ({
      type: "object",
      properties: { level: { type: "number", const: value } },
      required: ["level"],
    });
    const { provider, consumer } = pairWithResultSchema(withConst(0), withConst(1));
    expect(evaluateCompatibility(provider, consumer).status).toBe("fail");
  });
});
