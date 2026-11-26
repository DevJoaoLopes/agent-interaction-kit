import { describe, expect, it } from "vitest";
import type { ConsumerExpectations, ProviderManifest } from "../../src/contracts/types.js";
import { evaluateCompatibility } from "../../src/core/compatibility.js";

function manifests(
  providerFormat: "json" | "text" | "raw",
  consumerFormat: "json" | "text" | "raw",
): [ProviderManifest, ConsumerExpectations] {
  const provider: ProviderManifest = {
    schemaVersion: "1.0.0",
    producer: { name: "backend", version: "1.0.0", buildId: "b1" },
    protocolProfile: "ag-ui@0.1",
    contextProfile: "default",
    tools: [
      {
        name: "summarize",
        executionSide: "backend",
        parameters: { type: "object", properties: {} },
        returns: { format: providerFormat },
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
        toolName: "summarize",
        executionSide: "backend",
        expectedReturns: { format: consumerFormat },
      },
    ],
  };
  return [provider, consumer];
}

describe("return format mismatch", () => {
  it("fails with AIK-RESULT-004 when the consumer expects json and the provider returns text", () => {
    const report = evaluateCompatibility(...manifests("text", "json"));
    expect(report.status).toBe("fail");
    const diag = report.diagnostics.find((item) => item.code === "AIK-RESULT-004");
    expect(diag).toBeDefined();
    expect(diag?.expected).toBe("json");
    expect(diag?.actual).toBe("text");
  });

  it("passes when both sides declare the same return format", () => {
    const report = evaluateCompatibility(...manifests("json", "json"));
    expect(report.status).toBe("pass");
    expect(report.diagnostics).toEqual([]);
  });
});
