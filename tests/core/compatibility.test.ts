import { describe, expect, it } from "vitest";
import type { ConsumerExpectations, ProviderManifest } from "../../src/contracts/types.js";
import { evaluateCompatibility } from "../../src/core/compatibility.js";

describe("Compatibility Engine", () => {
  const baseProvider: ProviderManifest = {
    schemaVersion: "1.0.0",
    producer: { name: "test-backend", version: "1.0.0", buildId: "b1" },
    protocolProfile: "ag-ui@0.1",
    contextProfile: "default",
    tools: [
      {
        name: "searchDocuments",
        executionSide: "backend",
        parameters: {
          type: "object",
          properties: { query: { type: "string" }, limit: { type: "number" } },
          required: ["query"],
        },
        returns: {
          format: "json",
          schema: {
            type: "array",
            items: {
              type: "object",
              properties: { id: { type: "string" }, title: { type: "string" } },
              required: ["id", "title"],
            },
          },
        },
      },
    ],
  };

  const baseConsumer: ConsumerExpectations = {
    schemaVersion: "1.0.0",
    consumer: { name: "test-frontend", version: "1.0.0", buildId: "c1" },
    protocolProfile: "ag-ui@0.1",
    contextProfile: "default",
    requires: [
      {
        toolName: "searchDocuments",
        executionSide: "backend",
        expectedParameters: {
          type: "object",
          properties: { query: { type: "string" } },
          required: ["query"],
        },
        expectedReturns: {
          format: "json",
          schema: {
            type: "array",
            items: {
              type: "object",
              properties: { id: { type: "string" }, title: { type: "string" } },
              required: ["id", "title"],
            },
          },
        },
      },
    ],
  };

  it("passes when provider matches consumer expectations", () => {
    const report = evaluateCompatibility(baseProvider, baseConsumer);
    expect(report.status).toBe("pass");
    expect(report.diagnostics).toHaveLength(0);
  });

  it("fails with AIK-TOOL-001 when required tool is missing", () => {
    const consumerWithExtraTool: ConsumerExpectations = {
      ...baseConsumer,
      requires: [...baseConsumer.requires, { toolName: "missingTool", executionSide: "backend" }],
    };
    const report = evaluateCompatibility(baseProvider, consumerWithExtraTool);
    expect(report.status).toBe("fail");
    expect(report.diagnostics.some((d) => d.code === "AIK-TOOL-001")).toBe(true);
  });

  it("fails with AIK-RESULT-001 when result root type diverges (array -> object)", () => {
    const providerWithObjectResult: ProviderManifest = {
      ...baseProvider,
      tools: [
        {
          ...baseProvider.tools[0],
          returns: {
            format: "json",
            schema: {
              type: "object",
              properties: {
                items: { type: "array" },
                total: { type: "number" },
              },
              required: ["items", "total"],
            },
          },
        },
      ],
    };
    const report = evaluateCompatibility(providerWithObjectResult, baseConsumer);
    expect(report.status).toBe("fail");
    const diag = report.diagnostics.find((d) => d.code === "AIK-RESULT-001");
    expect(diag).toBeDefined();
    expect(diag?.toolName).toBe("searchDocuments");
  });

  it("fails with AIK-INPUT-001 when provider adds a new mandatory argument", () => {
    const providerWithMandatoryArg: ProviderManifest = {
      ...baseProvider,
      tools: [
        {
          ...baseProvider.tools[0],
          parameters: {
            type: "object",
            properties: {
              query: { type: "string" },
              tenantId: { type: "string" },
            },
            required: ["query", "tenantId"],
          },
        },
      ],
    };
    const report = evaluateCompatibility(providerWithMandatoryArg, baseConsumer);
    expect(report.status).toBe("fail");
    expect(report.diagnostics.some((d) => d.code === "AIK-INPUT-001")).toBe(true);
  });

  it("returns status unknown with AIK-SCHEMA-001 when schema contains unsupported construct", () => {
    const providerWithComplexSchema: ProviderManifest = {
      ...baseProvider,
      tools: [
        {
          ...baseProvider.tools[0],
          parameters: {
            type: "object",
            not: { properties: { banned: { type: "string" } } },
          },
        },
      ],
    };
    const report = evaluateCompatibility(providerWithComplexSchema, baseConsumer);
    expect(report.status).toBe("unknown");
    expect(report.diagnostics.some((d) => d.code === "AIK-SCHEMA-001")).toBe(true);
  });
});
