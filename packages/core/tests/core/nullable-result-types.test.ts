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

describe("nullable result types", () => {
  it("passes when both sides declare the same nullable result type", () => {
    const report = evaluateCompatibility(
      provider({ type: ["object", "null"], properties: {} }),
      consumer({ type: ["object", "null"], properties: {} }),
    );
    expect(report.status).toBe("pass");
    expect(report.diagnostics).toEqual([]);
  });

  it("passes when nullable type arrays are written in a different order", () => {
    const report = evaluateCompatibility(
      provider({ type: ["null", "object"], properties: {} }),
      consumer({ type: ["object", "null"], properties: {} }),
    );
    expect(report.status).toBe("pass");
    expect(report.diagnostics).toEqual([]);
  });

  it("fails when a nullable object result is compared with an array result", () => {
    const report = evaluateCompatibility(
      provider({ type: "array", items: { type: "string" } }),
      consumer({ type: ["object", "null"], properties: {} }),
    );
    expect(report.status).toBe("fail");
    const diag = report.diagnostics.find((item) => item.code === "AIK-RESULT-001");
    expect(diag).toBeDefined();
    expect(diag?.path).toBe("/returns/schema/type");
  });

  it("still checks required object fields when both sides use a nullable type array", () => {
    const report = evaluateCompatibility(
      provider({ type: ["object", "null"], properties: {} }),
      consumer({
        type: ["object", "null"],
        properties: { temperature: { type: "number" } },
        required: ["temperature"],
      }),
    );
    expect(report.status).toBe("fail");
    const diag = report.diagnostics.find((item) => item.code === "AIK-RESULT-002");
    expect(diag).toBeDefined();
    expect(diag?.path).toBe("/returns/schema/properties/temperature");
  });

  it('still checks scalar field types when both sides use type: ["object"]', () => {
    const report = evaluateCompatibility(
      provider({
        type: ["object"],
        properties: { temperature: { type: "string" } },
        required: ["temperature"],
      }),
      consumer({
        type: ["object"],
        properties: { temperature: { type: "number" } },
        required: ["temperature"],
      }),
    );
    expect(report.status).toBe("fail");
    const diag = report.diagnostics.find((item) => item.code === "AIK-RESULT-003");
    expect(diag).toBeDefined();
    expect(diag?.path).toBe("/returns/schema/properties/temperature/type");
  });

  it("still checks required item fields when both sides use a nullable array type", () => {
    const report = evaluateCompatibility(
      provider({
        type: ["array", "null"],
        items: { type: "object", properties: {} },
      }),
      consumer({
        type: ["array", "null"],
        items: {
          type: "object",
          properties: { id: { type: "string" } },
          required: ["id"],
        },
      }),
    );
    expect(report.status).toBe("fail");
    const diag = report.diagnostics.find((item) => item.code === "AIK-RESULT-002");
    expect(diag).toBeDefined();
    expect(diag?.path).toBe("/returns/schema/items/properties/id");
  });
});
