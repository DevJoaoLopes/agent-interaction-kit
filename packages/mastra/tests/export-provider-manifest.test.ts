import { parseProviderManifest } from "@agent-interaction-kit/core/contracts";
import { evaluateCompatibility } from "@agent-interaction-kit/core/core";
import { Agent } from "@mastra/core/agent";
import { createTool } from "@mastra/core/tools";
import { describe, expect, expectTypeOf, it } from "vitest";
import { z } from "zod";
import { type MastraAgentLike, exportProviderManifest } from "../src/index.js";

const meta = {
  producer: { name: "weather-agent", version: "1.0.0", buildId: "b1" },
  protocolProfile: "ag-ui@0.1",
  contextProfile: "default",
} as const;

const weatherTool = createTool({
  id: "weather-tool",
  description: "Get the weather for a city",
  inputSchema: z.object({ city: z.string(), units: z.enum(["c", "f"]).default("c") }),
  outputSchema: z.object({ temperature: z.number(), summary: z.string() }),
  execute: async () => ({ temperature: 21, summary: "sunny" }),
});
const searchTool = createTool({
  id: "search-tool",
  description: "Search documents",
  inputSchema: z.object({ query: z.string() }),
  requireApproval: true,
  execute: async () => ({}),
});
const confirmTool = createTool({
  id: "confirm-tool",
  description: "Ask the user to confirm",
  inputSchema: z.object({ title: z.string() }),
});

function agentWith(tools: Record<string, ReturnType<typeof createTool>>) {
  return new Agent({
    id: "weather-agent",
    name: "Weather agent",
    instructions: "Answer weather questions",
    model: "openai/gpt-4o-mini",
    tools,
  });
}

describe("exportProviderManifest", () => {
  it("accepts a real Mastra Agent structurally", () => {
    expectTypeOf<Agent>().toMatchTypeOf<MastraAgentLike>();
  });

  it("exports the tools of a real agent as a provider manifest that matches the expected fixture", async () => {
    const manifest = await exportProviderManifest({
      agent: agentWith({ getWeather: weatherTool }),
      ...meta,
    });
    expect(manifest).toEqual({
      schemaVersion: "1.0.0",
      producer: { name: "weather-agent", version: "1.0.0", buildId: "b1" },
      protocolProfile: "ag-ui@0.1",
      contextProfile: "default",
      tools: [
        {
          name: "getWeather",
          executionSide: "backend",
          description: "Get the weather for a city",
          parameters: {
            $schema: "http://json-schema.org/draft-07/schema#",
            type: "object",
            properties: {
              city: { type: "string" },
              units: { default: "c", type: "string", enum: ["c", "f"] },
            },
            required: ["city"],
            additionalProperties: false,
          },
          returns: {
            format: "json",
            schema: {
              $schema: "http://json-schema.org/draft-07/schema#",
              type: "object",
              properties: { temperature: { type: "number" }, summary: { type: "string" } },
              required: ["temperature", "summary"],
              additionalProperties: false,
            },
          },
        },
      ],
    });
    expect(parseProviderManifest(manifest).ok).toBe(true);
  });

  it("uses json format without a schema when the tool has no outputSchema", async () => {
    const manifest = await exportProviderManifest({
      agent: agentWith({ searchDocs: searchTool }),
      ...meta,
    });
    expect(manifest.tools[0]?.returns).toEqual({ format: "json" });
  });

  it("maps requireApproval and treats a tool without execute as a frontend tool", async () => {
    const manifest = await exportProviderManifest({
      agent: agentWith({ searchDocs: searchTool, confirm: confirmTool }),
      ...meta,
    });
    const byName = Object.fromEntries(manifest.tools.map((tool) => [tool.name, tool]));
    expect(byName.searchDocs?.requiresApproval).toBe(true);
    expect(byName.searchDocs?.executionSide).toBe("backend");
    expect(byName.confirm?.executionSide).toBe("frontend");
    expect(byName.confirm?.requiresApproval).toBeUndefined();
  });

  it("accepts a tools record instead of an agent", async () => {
    const manifest = await exportProviderManifest({ tools: { getWeather: weatherTool }, ...meta });
    expect(manifest.tools.map((tool) => tool.name)).toEqual(["getWeather"]);
  });

  it("turns a tool without inputSchema into an empty object schema", async () => {
    const bare = createTool({ id: "bare", description: "No input", execute: async () => ({}) });
    const manifest = await exportProviderManifest({ tools: { bare }, ...meta });
    expect(manifest.tools[0]?.parameters).toEqual({ type: "object", properties: {} });
  });

  it("produces a manifest that evaluateCompatibility accepts against a matching consumer", async () => {
    const provider = await exportProviderManifest({
      agent: agentWith({ getWeather: weatherTool }),
      ...meta,
    });
    const report = evaluateCompatibility(provider, {
      schemaVersion: "1.0.0",
      consumer: { name: "web", version: "1.0.0", buildId: "c1" },
      protocolProfile: "ag-ui@0.1",
      contextProfile: "default",
      requires: [
        {
          toolName: "getWeather",
          executionSide: "backend",
          expectedParameters: { type: "object", properties: { city: { type: "string" } } },
          expectedReturns: {
            format: "json",
            schema: {
              type: "object",
              properties: { temperature: { type: "number" } },
              required: ["temperature"],
            },
          },
        },
      ],
    });
    expect(report.status).toBe("pass");
  });

  it("throws a TypeError naming the tool when a schema is not a Standard JSON Schema", async () => {
    const legacy = { id: "legacy", description: "d", inputSchema: { type: "object" } };
    await expect(exportProviderManifest({ tools: { legacy } as never, ...meta })).rejects.toThrow(
      /legacy/,
    );
    await expect(
      exportProviderManifest({ tools: { legacy } as never, ...meta }),
    ).rejects.toBeInstanceOf(TypeError);
  });

  it("rejects a provider-run tool that has neither execute nor inputSchema", async () => {
    const placeholder = { [Symbol("web-search")]: true };
    await expect(
      exportProviderManifest({ tools: { webSearch: placeholder }, ...meta }),
    ).rejects.toThrow(/webSearch.*neither execute nor inputSchema/);
  });

  it("requires either an agent or a tools record", async () => {
    // @ts-expect-error neither agent nor tools was given
    await expect(exportProviderManifest({ ...meta })).rejects.toThrow(/agent.*tools/);
  });
});
