import { describe, expect, it } from "vitest";
import type { ConsumerExpectations, ProviderManifest } from "../../src/contracts/types.js";
import { evaluateCompatibility } from "../../src/core/compatibility.js";
import { checkResults } from "../../src/core/rules/results-rule.js";

describe("Result field scalar types", () => {
  const schema = (type: string) => ({
    type: "object",
    properties: { temperature: { type } },
    required: ["temperature"],
  });

  it("rejects a string result where the consumer requires a number", () => {
    const diagnostics = checkResults(
      { format: "json", schema: schema("number") },
      {
        name: "getWeather",
        executionSide: "backend",
        parameters: { type: "object" },
        returns: { format: "json", schema: schema("string") },
      },
    );
    expect(diagnostics).toContainEqual(
      expect.objectContaining({
        code: "AIK-RESULT-003",
        path: "/returns/schema/properties/temperature/type",
        expected: "number",
        actual: "string",
      }),
    );
  });

  it("allows integer output for a number consumer", () => {
    expect(
      checkResults(
        { format: "json", schema: schema("number") },
        {
          name: "getWeather",
          executionSide: "backend",
          parameters: { type: "object" },
          returns: { format: "json", schema: schema("integer") },
        },
      ),
    ).toEqual([]);
  });

  it("rejects number output for an integer consumer (incompatible)", () => {
    const diagnostics = checkResults(
      { format: "json", schema: schema("integer") },
      {
        name: "getWeather",
        executionSide: "backend",
        parameters: { type: "object" },
        returns: { format: "json", schema: schema("number") },
      },
    );
    expect(diagnostics).toContainEqual(
      expect.objectContaining({
        code: "AIK-RESULT-003",
        path: "/returns/schema/properties/temperature/type",
        expected: "integer",
        actual: "number",
      }),
    );
  });

  it("allows identical scalar types", () => {
    const scalarTypes = ["string", "number", "integer", "boolean", "null"];
    for (const type of scalarTypes) {
      expect(
        checkResults(
          { format: "json", schema: schema(type) },
          {
            name: "getWeather",
            executionSide: "backend",
            parameters: { type: "object" },
            returns: { format: "json", schema: schema(type) },
          },
        ),
      ).toEqual([]);
    }
  });

  it("properly escapes field names with slash and tilde in path (~1 and ~0)", () => {
    const fieldName = "station/temp~raw";
    const customSchema = (type: string) => ({
      type: "object",
      properties: { [fieldName]: { type } },
      required: [fieldName],
    });

    const diagnostics = checkResults(
      { format: "json", schema: customSchema("number") },
      {
        name: "getWeather",
        executionSide: "backend",
        parameters: { type: "object" },
        returns: { format: "json", schema: customSchema("string") },
      },
    );

    expect(diagnostics).toContainEqual(
      expect.objectContaining({
        code: "AIK-RESULT-003",
        path: "/returns/schema/properties/station~1temp~0raw/type",
        message: `Tool "getWeather": result field "${fieldName}" type is incompatible.`,
        expected: "number",
        actual: "string",
      }),
    );
  });

  it("returns status fail in evaluateCompatibility when provider produces incompatible scalar field", () => {
    const provider: ProviderManifest = {
      schemaVersion: "1.0.0",
      producer: { name: "weather-service", version: "1.0.0", buildId: "b101" },
      protocolProfile: "ag-ui@0.1",
      contextProfile: "default",
      tools: [
        {
          name: "getWeather",
          executionSide: "backend",
          parameters: {
            type: "object",
            properties: { city: { type: "string" } },
            required: ["city"],
          },
          returns: {
            format: "json",
            schema: {
              type: "object",
              properties: {
                temperature: { type: "string" },
              },
              required: ["temperature"],
            },
          },
        },
      ],
    };

    const consumer: ConsumerExpectations = {
      schemaVersion: "1.0.0",
      consumer: { name: "weather-widget", version: "1.0.0", buildId: "c101" },
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
          expectedReturns: {
            format: "json",
            schema: {
              type: "object",
              properties: {
                temperature: { type: "number" },
              },
              required: ["temperature"],
            },
          },
        },
      ],
    };

    const report = evaluateCompatibility(provider, consumer);

    expect(report.status).toBe("fail");
    expect(report.diagnostics).toContainEqual(
      expect.objectContaining({
        code: "AIK-RESULT-003",
        path: "/returns/schema/properties/temperature/type",
        toolName: "getWeather",
        expected: "number",
        actual: "string",
      }),
    );
  });
});
