import type { ProviderManifest, ToolDescriptor } from "../contracts/types.js";

export interface CreateProviderManifestInput {
  $schema?: string;
  schemaVersion?: string;
  producer: ProviderManifest["producer"];
  protocolProfile: string;
  contextProfile: string;
  tools: readonly ToolDescriptor[];
}

export function createProviderManifest(input: CreateProviderManifestInput): ProviderManifest {
  const manifest: ProviderManifest = {
    schemaVersion: input.schemaVersion ?? "1.0.0",
    producer: { ...input.producer },
    protocolProfile: input.protocolProfile,
    contextProfile: input.contextProfile,
    tools: input.tools.map((tool) => ({
      ...tool,
      parameters: { ...tool.parameters },
      returns: { ...tool.returns },
    })),
  };
  if (input.$schema !== undefined) {
    manifest.$schema = input.$schema;
  }
  return manifest;
}
