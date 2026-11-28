import type { Tool } from "@ag-ui/core";
import { describe, expect, expectTypeOf, it } from "vitest";
import { type AgUiToolLike, fromAgUiTools } from "../../src/ag-ui/index.js";
import { parseProviderManifest } from "../../src/contracts/parser.js";

describe("fromAgUiTools", () => {
  it("accepts the AG-UI Tool type structurally", () => {
    expectTypeOf<Tool>().toMatchTypeOf<AgUiToolLike>();
  });

  it("maps a tool with parameters to a frontend ToolDescriptor by default", () => {
    const tools: Tool[] = [
      {
        name: "getWeather",
        description: "Get the weather for a city",
        parameters: {
          type: "object",
          properties: { city: { type: "string" } },
          required: ["city"],
        },
      },
    ];
    expect(fromAgUiTools(tools)).toEqual([
      {
        name: "getWeather",
        executionSide: "frontend",
        description: "Get the weather for a city",
        parameters: {
          type: "object",
          properties: { city: { type: "string" } },
          required: ["city"],
        },
        returns: { format: "json" },
      },
    ]);
  });

  it("turns missing, null or empty parameters into an empty object schema", () => {
    const result = fromAgUiTools([
      { name: "a", description: "no parameters" },
      { name: "b", description: "null parameters", parameters: null },
      { name: "c", description: "empty parameters", parameters: {} },
    ]);
    expect(result.map((tool) => tool.parameters)).toEqual([
      { type: "object", properties: {} },
      { type: "object", properties: {} },
      { type: "object", properties: {} },
    ]);
  });

  it("uses the executionSide option for every tool", () => {
    const result = fromAgUiTools([{ name: "a", description: "d" }], { executionSide: "backend" });
    expect(result[0]?.executionSide).toBe("backend");
  });

  it("ignores metadata and omits an empty description", () => {
    const [tool] = fromAgUiTools([{ name: "a", description: "", metadata: { render: "card" } }]);
    expect(tool).toEqual({
      name: "a",
      executionSide: "frontend",
      parameters: { type: "object", properties: {} },
      returns: { format: "json" },
    });
  });

  it("throws a TypeError when parameters is not an object schema", () => {
    expect(() =>
      fromAgUiTools([{ name: "a", description: "d", parameters: { type: "string" } }]),
    ).toThrow(TypeError);
    expect(() => fromAgUiTools([{ name: "a", description: "d", parameters: "nope" }])).toThrow(
      /parameters must be a JSON Schema object/,
    );
  });

  it("produces descriptors that a provider manifest accepts", () => {
    const tools = fromAgUiTools([
      { name: "a", description: "d", parameters: { type: "object", properties: {} } },
    ]);
    const parsed = parseProviderManifest({
      schemaVersion: "1.0.0",
      producer: { name: "backend", version: "1.0.0", buildId: "b1" },
      protocolProfile: "ag-ui@0.1",
      contextProfile: "default",
      tools,
    });
    expect(parsed.ok).toBe(true);
  });
});
