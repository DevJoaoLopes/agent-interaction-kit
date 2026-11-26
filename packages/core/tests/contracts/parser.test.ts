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
    if (!result.ok) {
      expect(result.errors).toContain(
        "Provider manifest: Validation error at (root): must have required property 'schemaVersion'",
      );
    }
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

  describe.each([
    ["provider manifest", parseProviderManifest],
    ["consumer expectations", parseConsumerExpectations],
  ] as const)("%s edge cases", (_name, parse) => {
    it.each(["", "{", "not json"])("rejects malformed or empty JSON: %j", (input) => {
      expect(() => parse(input)).not.toThrow();
      const result = parse(input);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.errors.length).toBeGreaterThan(0);
      }
    });

    it.each(['"raw string"', "42", "true"])("rejects primitive JSON payload: %s", (input) => {
      expect(() => parse(input)).not.toThrow();
      const result = parse(input);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.errors.length).toBeGreaterThan(0);
        expect(result.errors[0]).toContain("Validation error at (root):");
      }
    });
  });

  it("rejects a provider manifest with two tools of the same name", () => {
    const duplicate = JSON.parse(JSON.stringify(validProvider)) as typeof validProvider;
    duplicate.tools = [...duplicate.tools, { ...duplicate.tools[0] }];
    const result = parseProviderManifest(duplicate);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(
        result.errors.some((error) => /duplicate tool name "searchDocuments"/i.test(error)),
      ).toBe(true);
    }
  });

  it("rejects a provider tool whose parameters type is not object", () => {
    const invalid = JSON.parse(JSON.stringify(validProvider)) as typeof validProvider;
    invalid.tools[0].parameters = { type: "string" } as (typeof invalid.tools)[0]["parameters"];
    const result = parseProviderManifest(invalid);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(
        result.errors.some((error) => /parameters/i.test(error) && /object/i.test(error)),
      ).toBe(true);
    }
  });
});
