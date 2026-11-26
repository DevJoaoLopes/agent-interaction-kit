import { describe, expect, it } from "vitest";
import type { ConsumerExpectations, ProviderManifest } from "../../src/contracts/types.js";
import { evaluateCompatibility } from "../../src/core/compatibility.js";

function pair(providerType: string, consumerType: string) {
  const provider: ProviderManifest = {
    schemaVersion: "1.0.0",
    producer: { name: "backend", version: "1.0.0", buildId: "b1" },
    protocolProfile: "ag-ui@0.1",
    contextProfile: "default",
    tools: [
      {
        name: "w",
        executionSide: "backend",
        parameters: { type: "object", properties: {} },
        returns: { format: "json", schema: { type: providerType } },
      },
    ],
  };
  const consumer: ConsumerExpectations = {
    schemaVersion: "1.0.0",
    consumer: { name: "frontend", version: "1.0.0", buildId: "c1" },
    protocolProfile: "ag-ui@0.1",
    contextProfile: "default",
    requires: [
      {
        toolName: "w",
        executionSide: "backend",
        expectedReturns: { format: "json", schema: { type: consumerType } },
      },
    ],
  };
  return evaluateCompatibility(provider, consumer);
}

describe("root result type mismatch", () => {
  it("keeps AIK-RESULT-001 when the root scalar types differ", () => {
    const report = pair("string", "number");
    expect(report.status).toBe("fail");
    expect(report.diagnostics.map((item) => item.code)).toEqual(["AIK-RESULT-001"]);
    expect(report.diagnostics[0]?.path).toBe("/returns/schema/type");
  });
});
