import { describe, expect, it } from "vitest";
import type { ConsumerExpectations, ProviderManifest } from "../../src/contracts/types.js";
import { evaluateCompatibility } from "../../src/core/compatibility.js";

const consumer: ConsumerExpectations = {
  schemaVersion: "1.0.0",
  consumer: { name: "frontend", version: "1.0.0", buildId: "c1" },
  protocolProfile: "ag-ui@0.1",
  contextProfile: "default",
  requires: [
    {
      toolName: "weather",
      executionSide: "backend",
      expectedReturns: {
        format: "json",
        schema: {
          type: "object",
          properties: { temp: { type: "number" }, unit: { type: "string" } },
          required: ["temp"],
        },
      },
    },
  ],
};

function providerWith(schema: Record<string, unknown>): ProviderManifest {
  return {
    schemaVersion: "1.0.0",
    producer: { name: "backend", version: "1.0.0", buildId: "b1" },
    protocolProfile: "ag-ui@0.1",
    contextProfile: "default",
    tools: [
      {
        name: "weather",
        executionSide: "backend",
        parameters: { type: "object", properties: {} },
        returns: { format: "json", schema },
      },
    ],
  };
}

describe("guaranteed result fields", () => {
  it("fails with AIK-RESULT-002 when the consumer requires a field the provider only declares as optional", () => {
    const report = evaluateCompatibility(
      providerWith({
        type: "object",
        properties: { temp: { type: "number" }, unit: { type: "string" } },
      }),
      consumer,
    );
    expect(report.status).toBe("fail");
    const diag = report.diagnostics.find((item) => item.code === "AIK-RESULT-002");
    expect(diag).toBeDefined();
    expect(diag?.path).toBe("/returns/schema/properties/temp");
    expect(diag?.message).toMatch(/optional/i);
    expect(diag?.message).not.toMatch(/missing/i);
  });

  it("keeps a distinct missing-field message when the provider omits the property entirely", () => {
    const report = evaluateCompatibility(
      providerWith({
        type: "object",
        properties: { unit: { type: "string" } },
        required: ["unit"],
      }),
      consumer,
    );
    expect(report.status).toBe("fail");
    const diag = report.diagnostics.find((item) => item.code === "AIK-RESULT-002");
    expect(diag).toBeDefined();
    expect(diag?.message).toMatch(/missing/i);
    expect(diag?.message).not.toMatch(/optional/i);
  });

  it("passes when the provider requires every result field the consumer reads", () => {
    const report = evaluateCompatibility(
      providerWith({
        type: "object",
        properties: { temp: { type: "number" }, unit: { type: "string" } },
        required: ["temp"],
      }),
      consumer,
    );
    expect(report.status).toBe("pass");
    expect(report.diagnostics).toEqual([]);
  });
});
