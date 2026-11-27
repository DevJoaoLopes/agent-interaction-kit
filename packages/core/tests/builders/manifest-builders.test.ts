import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  createConsumerExpectations,
  createProviderManifest,
  toolFromJsonSchema,
} from "../../src/builders/index.js";
import { parseConsumerExpectations, parseProviderManifest } from "../../src/contracts/parser.js";
import type { ToolDescriptor } from "../../src/contracts/types.js";

const fixturesDir = join(dirname(fileURLToPath(import.meta.url)), "../../fixtures/valid");

describe("manifest builders", () => {
  it("builds a provider manifest that parseProviderManifest accepts and matches the valid fixture", () => {
    const raw = JSON.parse(readFileSync(join(fixturesDir, "provider.json"), "utf8")) as Record<
      string,
      unknown
    >;
    const built = createProviderManifest({
      $schema: raw.$schema as string,
      schemaVersion: raw.schemaVersion as string,
      producer: raw.producer as { name: string; version: string; buildId: string },
      protocolProfile: raw.protocolProfile as string,
      contextProfile: raw.contextProfile as string,
      tools: raw.tools as ToolDescriptor[],
    });
    const parsedBuilt = parseProviderManifest(built);
    const parsedFixture = parseProviderManifest(raw);
    expect(parsedBuilt.ok).toBe(true);
    expect(parsedFixture.ok).toBe(true);
    if (parsedBuilt.ok && parsedFixture.ok) {
      expect(parsedBuilt.data).toEqual(parsedFixture.data);
    }
  });

  it("builds a consumer manifest that parseConsumerExpectations accepts and matches the valid fixture", () => {
    const raw = JSON.parse(readFileSync(join(fixturesDir, "consumer.json"), "utf8")) as Record<
      string,
      unknown
    >;
    const built = createConsumerExpectations({
      $schema: raw.$schema as string,
      schemaVersion: raw.schemaVersion as string,
      consumer: raw.consumer as { name: string; version: string; buildId: string },
      protocolProfile: raw.protocolProfile as string,
      contextProfile: raw.contextProfile as string,
      requires: raw.requires as Parameters<typeof createConsumerExpectations>[0]["requires"],
    });
    const parsedBuilt = parseConsumerExpectations(built);
    const parsedFixture = parseConsumerExpectations(raw);
    expect(parsedBuilt.ok).toBe(true);
    expect(parsedFixture.ok).toBe(true);
    if (parsedBuilt.ok && parsedFixture.ok) {
      expect(parsedBuilt.data).toEqual(parsedFixture.data);
    }
  });

  it("defaults schemaVersion to 1.0.0 and accepts tools declared with as const satisfies", () => {
    const tools = [
      {
        name: "ping",
        executionSide: "backend",
        parameters: { type: "object", properties: {} },
        returns: { format: "json" },
      },
    ] as const satisfies readonly ToolDescriptor[];
    const built = createProviderManifest({
      producer: { name: "backend", version: "1.0.0", buildId: "b1" },
      protocolProfile: "ag-ui@0.1",
      contextProfile: "default",
      tools,
    });
    expect(built.schemaVersion).toBe("1.0.0");
    const parsed = parseProviderManifest(built);
    expect(parsed.ok).toBe(true);
  });

  it("builds a tool descriptor from a JSON Schema parameter object", () => {
    const tool = toolFromJsonSchema({
      name: "searchDocuments",
      executionSide: "backend",
      description: "Searches internal documents",
      parameters: {
        type: "object",
        properties: { query: { type: "string" } },
        required: ["query"],
      },
      returns: {
        format: "json",
        schema: {
          type: "array",
          items: { type: "object", properties: { id: { type: "string" } } },
        },
      },
    });
    expect(tool.name).toBe("searchDocuments");
    expect(tool.parameters.type).toBe("object");
    const parsed = parseProviderManifest({
      schemaVersion: "1.0.0",
      producer: { name: "backend", version: "1.0.0", buildId: "b1" },
      protocolProfile: "ag-ui@0.1",
      contextProfile: "default",
      tools: [tool],
    });
    expect(parsed.ok).toBe(true);
  });

  it("defaults omitted returns to json without a schema and fills missing parameters type as object", () => {
    const tool = toolFromJsonSchema({
      name: "confirm",
      executionSide: "frontend",
      parameters: { properties: { title: { type: "string" } } },
    });
    expect(tool.returns).toEqual({ format: "json" });
    expect(tool.parameters.type).toBe("object");
    expect(tool.parameters.properties).toEqual({ title: { type: "string" } });
  });

  it("throws when parameters.type is present and is not object", () => {
    expect(() =>
      toolFromJsonSchema({
        name: "broken",
        executionSide: "backend",
        parameters: { type: "string" },
      }),
    ).toThrow(TypeError);
    expect(() =>
      toolFromJsonSchema({
        name: "broken",
        executionSide: "backend",
        parameters: { type: "string" },
      }),
    ).toThrow(/parameters.type must be "object"/);
  });
});
