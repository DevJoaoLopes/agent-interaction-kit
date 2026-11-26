import { describe, expect, it } from "vitest";
import type { ConsumerExpectations, ProviderManifest } from "../../src/contracts/types.js";
import { evaluateCompatibility } from "../../src/core/compatibility.js";

function backendPair(
  providerProp: Record<string, unknown>,
  consumerProp: Record<string, unknown>,
): { provider: ProviderManifest; consumer: ConsumerExpectations } {
  return {
    provider: {
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
            properties: { units: providerProp },
            required: ["units"],
          },
          returns: { format: "json" },
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
          toolName: "getWeather",
          executionSide: "backend",
          expectedParameters: {
            type: "object",
            properties: { units: consumerProp },
            required: ["units"],
          },
        },
      ],
    },
  };
}

function frontendPair(
  providerProp: Record<string, unknown>,
  consumerProp: Record<string, unknown>,
): { provider: ProviderManifest; consumer: ConsumerExpectations } {
  return {
    provider: {
      schemaVersion: "1.0.0",
      producer: { name: "backend", version: "1.0.0", buildId: "b1" },
      protocolProfile: "ag-ui@0.1",
      contextProfile: "default",
      tools: [
        {
          name: "confirmAction",
          executionSide: "frontend",
          parameters: {
            type: "object",
            properties: { count: providerProp },
            required: ["count"],
          },
          returns: { format: "json" },
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
          toolName: "confirmAction",
          executionSide: "frontend",
          expectedParameters: {
            type: "object",
            properties: { count: consumerProp },
            required: ["count"],
          },
        },
      ],
    },
  };
}

describe("argument scalar types", () => {
  it("fails with AIK-INPUT-003 when a backend tool argument type differs (UI reads string, provider is number)", () => {
    const { provider, consumer } = backendPair({ type: "number" }, { type: "string" });
    const report = evaluateCompatibility(provider, consumer);
    expect(report.status).toBe("fail");
    const diag = report.diagnostics.find((item) => item.code === "AIK-INPUT-003");
    expect(diag).toBeDefined();
    expect(diag?.path).toBe("/parameters/properties/units/type");
    expect(diag?.expected).toBe("string");
    expect(diag?.actual).toBe("number");
  });

  it("allows a backend integer argument when the UI reads it as number", () => {
    const { provider, consumer } = backendPair({ type: "integer" }, { type: "number" });
    const report = evaluateCompatibility(provider, consumer);
    expect(report.status).toBe("pass");
    expect(report.diagnostics).toEqual([]);
  });

  it("fails when a backend number argument is read as integer by the UI", () => {
    const { provider, consumer } = backendPair({ type: "number" }, { type: "integer" });
    const report = evaluateCompatibility(provider, consumer);
    expect(report.status).toBe("fail");
    const diag = report.diagnostics.find((item) => item.code === "AIK-INPUT-003");
    expect(diag).toBeDefined();
    expect(diag?.expected).toBe("integer");
    expect(diag?.actual).toBe("number");
  });

  it("fails with AIK-INPUT-003 when a frontend tool emitter type is incompatible with the receptor", () => {
    const { provider, consumer } = frontendPair({ type: "string" }, { type: "number" });
    const report = evaluateCompatibility(provider, consumer);
    expect(report.status).toBe("fail");
    const diag = report.diagnostics.find((item) => item.code === "AIK-INPUT-003");
    expect(diag).toBeDefined();
    expect(diag?.path).toBe("/parameters/properties/count/type");
    expect(diag?.expected).toBe("number");
    expect(diag?.actual).toBe("string");
  });

  it("allows a frontend integer argument when the receptor accepts number", () => {
    const { provider, consumer } = frontendPair({ type: "integer" }, { type: "number" });
    const report = evaluateCompatibility(provider, consumer);
    expect(report.status).toBe("pass");
    expect(report.diagnostics).toEqual([]);
  });

  it("fails when a frontend emitter sends number but the receptor requires integer", () => {
    const { provider, consumer } = frontendPair({ type: "number" }, { type: "integer" });
    const report = evaluateCompatibility(provider, consumer);
    expect(report.status).toBe("fail");
    const diag = report.diagnostics.find((item) => item.code === "AIK-INPUT-003");
    expect(diag).toBeDefined();
    expect(diag?.expected).toBe("integer");
    expect(diag?.actual).toBe("number");
  });

  it("passes when argument scalar types match on both sides", () => {
    const backend = backendPair({ type: "string" }, { type: "string" });
    expect(evaluateCompatibility(backend.provider, backend.consumer).diagnostics).toEqual([]);
    const frontend = frontendPair({ type: "number" }, { type: "number" });
    expect(evaluateCompatibility(frontend.provider, frontend.consumer).diagnostics).toEqual([]);
  });
});
