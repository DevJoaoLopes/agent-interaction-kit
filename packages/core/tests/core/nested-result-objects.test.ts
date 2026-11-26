import { describe, expect, it } from "vitest";
import type { ConsumerExpectations, ProviderManifest } from "../../src/contracts/types.js";
import { evaluateCompatibility } from "../../src/core/compatibility.js";

function provider(schema: Record<string, unknown>): ProviderManifest {
  return {
    schemaVersion: "1.0.0",
    producer: { name: "backend", version: "1.0.0", buildId: "b1" },
    protocolProfile: "ag-ui@0.1",
    contextProfile: "default",
    tools: [
      {
        name: "w",
        executionSide: "backend",
        parameters: { type: "object", properties: {} },
        returns: { format: "json", schema },
      },
    ],
  };
}

function consumer(schema: Record<string, unknown>): ConsumerExpectations {
  return {
    schemaVersion: "1.0.0",
    consumer: { name: "frontend", version: "1.0.0", buildId: "c1" },
    protocolProfile: "ag-ui@0.1",
    contextProfile: "default",
    requires: [
      {
        toolName: "w",
        executionSide: "backend",
        expectedReturns: { format: "json", schema },
      },
    ],
  };
}

describe("nested result objects and array items", () => {
  it("fails with AIK-RESULT-002 when a nested required field is missing", () => {
    const report = evaluateCompatibility(
      provider({
        type: "object",
        properties: { data: { type: "object", properties: {}, required: [] } },
        required: ["data"],
      }),
      consumer({
        type: "object",
        properties: {
          data: {
            type: "object",
            properties: { title: { type: "string" } },
            required: ["title"],
          },
        },
        required: ["data"],
      }),
    );
    expect(report.status).toBe("fail");
    const diag = report.diagnostics.find((item) => item.code === "AIK-RESULT-002");
    expect(diag).toBeDefined();
    expect(diag?.path).toBe("/returns/schema/properties/data/properties/title");
  });

  it("fails with AIK-RESULT-003 when array item scalar types differ", () => {
    const report = evaluateCompatibility(
      provider({ type: "array", items: { type: "number" } }),
      consumer({ type: "array", items: { type: "string" } }),
    );
    expect(report.status).toBe("fail");
    const diag = report.diagnostics.find((item) => item.code === "AIK-RESULT-003");
    expect(diag).toBeDefined();
    expect(diag?.path).toBe("/returns/schema/items/type");
    expect(diag?.expected).toBe("string");
    expect(diag?.actual).toBe("number");
  });

  it("fails with AIK-RESULT-002 when a nested field is only optional on the provider", () => {
    const report = evaluateCompatibility(
      provider({
        type: "object",
        properties: {
          data: {
            type: "object",
            properties: { title: { type: "string" } },
          },
        },
        required: ["data"],
      }),
      consumer({
        type: "object",
        properties: {
          data: {
            type: "object",
            properties: { title: { type: "string" } },
            required: ["title"],
          },
        },
        required: ["data"],
      }),
    );
    expect(report.status).toBe("fail");
    const diag = report.diagnostics.find((item) => item.code === "AIK-RESULT-002");
    expect(diag).toBeDefined();
    expect(diag?.path).toBe("/returns/schema/properties/data/properties/title");
    expect(diag?.message).toMatch(/optional/i);
  });

  it("passes when nested required fields and array item types are guaranteed", () => {
    const objectSchema = {
      type: "object",
      properties: {
        data: {
          type: "object",
          properties: { title: { type: "string" } },
          required: ["title"],
        },
      },
      required: ["data"],
    };
    const objectReport = evaluateCompatibility(provider(objectSchema), consumer(objectSchema));
    expect(objectReport.status).toBe("pass");
    expect(objectReport.diagnostics).toEqual([]);

    const arraySchema = { type: "array", items: { type: "string" } };
    const arrayReport = evaluateCompatibility(provider(arraySchema), consumer(arraySchema));
    expect(arrayReport.status).toBe("pass");
    expect(arrayReport.diagnostics).toEqual([]);
  });
});
