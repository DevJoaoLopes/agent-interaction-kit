import { describe, expect, it } from "vitest";
import type { ConsumerExpectations, ProviderManifest } from "../../src/contracts/types.js";
import { evaluateCompatibility } from "../../src/core/compatibility.js";

const provider: ProviderManifest = {
  schemaVersion: "1.0.0",
  producer: { name: "backend", version: "1.0.0", buildId: "b1" },
  protocolProfile: "ag-ui@0.1",
  contextProfile: "default",
  tools: [
    {
      name: "getWeather",
      executionSide: "backend",
      parameters: {
        type: "object",
        properties: { city: { type: "string" }, units: { type: "string" } },
        required: [],
      },
      returns: { format: "json" },
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
      toolName: "getWeather",
      executionSide: "backend",
      expectedParameters: {
        type: "object",
        properties: { city: { type: "string" } },
        required: ["city"],
      },
    },
  ],
};

describe("backend tool argument covariance", () => {
  it("fails with AIK-INPUT-001 when the UI reads a required argument the provider marks optional", () => {
    const report = evaluateCompatibility(provider, consumer);
    expect(report.status).toBe("fail");
    const diag = report.diagnostics.find((item) => item.code === "AIK-INPUT-001");
    expect(diag).toBeDefined();
    expect(diag?.message).toMatch(/city/);
  });

  it("passes when the provider requires every argument the UI reads", () => {
    const guaranteed: ProviderManifest = structuredClone(provider);
    guaranteed.tools[0].parameters.required = ["city"];
    const report = evaluateCompatibility(guaranteed, consumer);
    expect(report.status).toBe("pass");
    expect(report.diagnostics).toEqual([]);
  });
});
