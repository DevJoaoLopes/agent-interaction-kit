import { describe, expect, it } from "vitest";
import { parseConsumerExpectations, parseProviderManifest } from "../../src/contracts/parser.js";

describe("Contracts Parser", () => {
  const validProvider = {
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
          properties: { query: { type: "string" } },
          required: ["query"],
        },
        returns: {
          format: "json",
          schema: {
            type: "array",
            items: { type: "object", properties: { id: { type: "string" } }, required: ["id"] },
          },
        },
      },
    ],
  };

  const validConsumer = {
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
            items: { type: "object", properties: { id: { type: "string" } }, required: ["id"] },
          },
        },
      },
    ],
  };

  it("parses valid provider manifest", () => {
    const result = parseProviderManifest(validProvider);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.producer.name).toBe("test-backend");
      expect(result.data.tools[0].name).toBe("searchDocuments");
    }
  });

  it("fails when provider manifest lacks schemaVersion", () => {
    const invalid = { ...validProvider, schemaVersion: undefined };
    const result = parseProviderManifest(invalid);
    expect(result.ok).toBe(false);
  });

  it("parses valid consumer expectations", () => {
    const result = parseConsumerExpectations(validConsumer);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.consumer.name).toBe("test-frontend");
      expect(result.data.requires[0].toolName).toBe("searchDocuments");
    }
  });

  it("fails when tool executionSide is invalid", () => {
    const invalid = {
      ...validProvider,
      tools: [{ ...validProvider.tools[0], executionSide: "cloud" }],
    };
    const result = parseProviderManifest(invalid);
    expect(result.ok).toBe(false);
  });
});
