import { describe, expect, it } from "vitest";
import type { ConsumerExpectations, ProviderManifest } from "../../src/contracts/types.js";
import { evaluateCompatibility } from "../../src/core/compatibility.js";

describe("Compatibility Engine", () => {
  const unsupportedKeywords = [
    "not",
    "patternProperties",
    "oneOf",
    "anyOf",
    "allOf",
    "$ref",
  ] as const;

  const createNestedUnsupportedSchema = (keyword: (typeof unsupportedKeywords)[number]) => ({
    type: "object",
    properties: {
      filters: {
        type: "array",
        items: {
          type: "object",
          properties: {
            value: {
              type: "string",
              [keyword]: keyword === "$ref" ? "#/$defs/value" : {},
            },
          },
        },
      },
    },
  });

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

  describe.each(["provider", "consumer"] as const)("%s schema safety", (side) => {
    describe.each(["parameters", "returns"] as const)("%s", (location) => {
      const evaluateSchema = (schema: Record<string, unknown>) => {
        const provider = structuredClone(baseProvider);
        const consumer = structuredClone(baseConsumer);
        // Keep both schemas compatible so only the safety check can reject them.
        provider.tools[0].parameters = { type: "object" };
        consumer.requires[0].expectedParameters = { type: "object" };
        provider.tools[0].returns = { format: "json", schema: { type: "object" } };
        consumer.requires[0].expectedReturns = { format: "json", schema: { type: "object" } };
        if (side === "provider") {
          if (location === "parameters") provider.tools[0].parameters = schema;
          else provider.tools[0].returns = { format: "json", schema };
        } else if (location === "parameters") consumer.requires[0].expectedParameters = schema;
        else consumer.requires[0].expectedReturns = { format: "json", schema };
        return evaluateCompatibility(provider, consumer);
      };

      it.each([
        {
          name: "tuple items",
          schema: {
            type: "object",
            properties: { values: { type: "array", items: [{ type: "string" }, { not: {} }] } },
          },
          path: "/properties/values/items/1/not",
        },
        {
          name: "prefixItems",
          schema: {
            type: "object",
            properties: {
              values: { type: "array", prefixItems: [{ type: "string" }, { not: {} }] },
            },
          },
          path: "/properties/values/prefixItems/1/not",
        },
        {
          name: "additionalProperties",
          schema: { type: "object", additionalProperties: { not: {} } },
          path: "/additionalProperties/not",
        },
        {
          name: "escaped property names",
          schema: { type: "object", properties: { "a/b~c": { not: {} } } },
          path: "/properties/a~1b~0c/not",
        },
      ])("reports unknown with an exact path for $name", ({ schema, path }) => {
        const report = evaluateSchema(schema);
        expect(report.status).toBe("unknown");
        expect(report.diagnostics).toContainEqual(
          expect.objectContaining({
            code: "AIK-SCHEMA-001",
            path: `${location === "parameters" ? "/parameters" : "/returns/schema"}${path}`,
          }),
        );
      });

      it.each(["definitions", "$defs"])("ignores unreferenced %s", (keyword) => {
        const report = evaluateSchema({ type: "object", [keyword]: { unused: { not: {} } } });
        expect(report.status).toBe("pass");
        expect(report.diagnostics).toHaveLength(0);
      });
    });
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

  it.each(unsupportedKeywords)(
    "returns unknown for deeply nested %s in a parameters schema",
    (keyword) => {
      const providerWithComplexSchema: ProviderManifest = {
        ...baseProvider,
        tools: [
          {
            ...baseProvider.tools[0],
            parameters: createNestedUnsupportedSchema(keyword),
          },
        ],
      };

      const report = evaluateCompatibility(providerWithComplexSchema, baseConsumer);
      const diagnostic = report.diagnostics.find((item) => item.code === "AIK-SCHEMA-001");

      expect(report.status).toBe("unknown");
      expect(diagnostic?.path).toBe(
        `/parameters/properties/filters/items/properties/value/${keyword}`,
      );
    },
  );

  it.each(unsupportedKeywords)(
    "returns unknown for deeply nested %s in a returns schema",
    (keyword) => {
      const providerWithComplexSchema: ProviderManifest = {
        ...baseProvider,
        tools: [
          {
            ...baseProvider.tools[0],
            returns: {
              format: "json",
              schema: {
                type: "array",
                items: createNestedUnsupportedSchema(keyword),
              },
            },
          },
        ],
      };

      const report = evaluateCompatibility(providerWithComplexSchema, baseConsumer);
      const diagnostic = report.diagnostics.find((item) => item.code === "AIK-SCHEMA-001");

      expect(report.status).toBe("unknown");
      expect(diagnostic?.path).toBe(
        `/returns/schema/items/properties/filters/items/properties/value/${keyword}`,
      );
    },
  );

  it("fails with AIK-INPUT-002 when consumer allows enum values not accepted by provider", () => {
    const providerWithEnum: ProviderManifest = {
      ...baseProvider,
      tools: [
        {
          ...baseProvider.tools[0],
          parameters: {
            type: "object",
            properties: {
              query: { type: "string" },
              status: { enum: ["active", "archived"] },
            },
            required: ["query"],
          },
        },
      ],
    };

    const consumerWithBroaderEnum: ConsumerExpectations = {
      ...baseConsumer,
      requires: [
        {
          toolName: "searchDocuments",
          executionSide: "backend",
          expectedParameters: {
            type: "object",
            properties: {
              query: { type: "string" },
              status: { enum: ["active", "archived", "pending"] },
            },
            required: ["query"],
          },
        },
      ],
    };

    const report = evaluateCompatibility(providerWithEnum, consumerWithBroaderEnum);
    expect(report.status).toBe("fail");
    const diag = report.diagnostics.find((d) => d.code === "AIK-INPUT-002");
    expect(diag).toBeDefined();
    expect(diag?.message).toContain("pending");
  });

  it("evaluates frontend tool argument contravariance in reverse direction", () => {
    const frontendProvider: ProviderManifest = {
      ...baseProvider,
      tools: [
        {
          name: "showModal",
          executionSide: "frontend",
          parameters: {
            type: "object",
            properties: {
              title: { type: "string" },
            },
          },
          returns: { format: "json" },
        },
      ],
    };

    const frontendConsumerWithRequired: ConsumerExpectations = {
      ...baseConsumer,
      requires: [
        {
          toolName: "showModal",
          executionSide: "frontend",
          expectedParameters: {
            type: "object",
            properties: {
              title: { type: "string" },
              confirmButtonText: { type: "string" },
            },
            required: ["confirmButtonText"],
          },
        },
      ],
    };

    // Consumer (frontend) requires confirmButtonText, but provider (backend emitter) does not declare it
    const report = evaluateCompatibility(frontendProvider, frontendConsumerWithRequired);
    expect(report.status).toBe("fail");
    const diag = report.diagnostics.find((d) => d.code === "AIK-INPUT-001");
    expect(diag).toBeDefined();
    expect(diag?.message).toContain('consumer requires mandatory argument "confirmButtonText"');
  });
});
