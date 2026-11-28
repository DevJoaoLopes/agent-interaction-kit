import { createProviderManifest, toolFromJsonSchema } from "@agent-interaction-kit/core/builders";
import type { ExecutionSide, ProviderManifest } from "@agent-interaction-kit/core/contracts";
import { isStandardSchemaWithJSON, standardSchemaToJSONSchema } from "@mastra/core/schema";

export type MastraToolLike = object;

interface ToolFields {
  description?: unknown;
  inputSchema?: unknown;
  outputSchema?: unknown;
  execute?: unknown;
  requireApproval?: unknown;
}

export interface MastraAgentLike {
  listTools(): Promise<Record<string, MastraToolLike>> | Record<string, MastraToolLike>;
}

interface ManifestMetadata {
  $schema?: string;
  schemaVersion?: string;
  producer: ProviderManifest["producer"];
  protocolProfile: string;
  contextProfile: string;
}

export type ExportProviderManifestInput = ManifestMetadata &
  (
    | { agent: MastraAgentLike; tools?: undefined }
    | { tools: Record<string, MastraToolLike>; agent?: undefined }
  );

function convert(schema: unknown, io: "input" | "output", name: string): Record<string, unknown> {
  if (!isStandardSchemaWithJSON(schema)) {
    throw new TypeError(
      `exportProviderManifest: ${io}Schema of tool "${name}" is not a Standard JSON Schema.`,
    );
  }
  return standardSchemaToJSONSchema(schema, { io }) as Record<string, unknown>;
}

export async function exportProviderManifest(
  input: ExportProviderManifestInput,
): Promise<ProviderManifest> {
  const tools = input.agent ? await input.agent.listTools() : input.tools;
  if (!tools) {
    throw new TypeError("exportProviderManifest: pass either an agent or a tools record.");
  }
  const descriptors = Object.entries(tools).map(([name, value]) => {
    const tool = value as ToolFields;
    if (tool.execute === undefined && tool.inputSchema === undefined) {
      throw new TypeError(
        `exportProviderManifest: tool "${name}" has neither execute nor inputSchema, so it is not a Mastra tool AIK can describe.`,
      );
    }
    const executionSide: ExecutionSide =
      typeof tool.execute === "function" ? "backend" : "frontend";
    const descriptor = toolFromJsonSchema({
      name,
      executionSide,
      ...(typeof tool.description === "string" && tool.description !== ""
        ? { description: tool.description }
        : {}),
      parameters:
        tool.inputSchema === undefined
          ? { type: "object", properties: {} }
          : convert(tool.inputSchema, "input", name),
      returns: {
        format: "json",
        ...(tool.outputSchema === undefined
          ? {}
          : { schema: convert(tool.outputSchema, "output", name) }),
      },
      ...(tool.requireApproval === true ? { requiresApproval: true } : {}),
    });
    return descriptor;
  });
  return createProviderManifest({
    ...(input.$schema === undefined ? {} : { $schema: input.$schema }),
    ...(input.schemaVersion === undefined ? {} : { schemaVersion: input.schemaVersion }),
    producer: input.producer,
    protocolProfile: input.protocolProfile,
    contextProfile: input.contextProfile,
    tools: descriptors,
  });
}
