import type { ConsumerExpectations, ProviderManifest } from "@agent-interaction-kit/core/contracts";
export const provider: ProviderManifest = {
  schemaVersion: "1.0.0",
  producer: { name: "store-agent", version: "1.0.0", buildId: "backend-1042" },
  protocolProfile: "ag-ui@0.1",
  contextProfile: "default",
  tools: [
    {
      name: "getOrder",
      executionSide: "backend",
      parameters: { type: "object", properties: { id: { type: "string" } }, required: ["id"] },
      returns: {
        format: "json",
        schema: {
          type: "object",
          properties: { id: { type: "string" }, total: { type: "number" } },
          required: ["id", "total"],
        },
      },
    },
  ],
};
export const consumer: ConsumerExpectations = {
  schemaVersion: "1.0.0",
  consumer: { name: "store-ui", version: "1.0.0", buildId: "frontend-1042" },
  protocolProfile: "ag-ui@0.1",
  contextProfile: "default",
  requires: [
    {
      toolName: "getOrder",
      executionSide: "backend",
      expectedParameters: {
        type: "object",
        properties: { id: { type: "string" } },
        required: ["id"],
      },
      expectedReturns: {
        format: "json",
        schema: {
          type: "object",
          properties: { id: { type: "string" }, total: { type: "number" } },
          required: ["id", "total"],
        },
      },
    },
  ],
};
export const broken = structuredClone(provider);
broken.tools[0].returns.schema = {
  type: "object",
  properties: { id: { type: "string" }, amount: { type: "number" } },
  required: ["id", "amount"],
};
export const unknown = structuredClone(provider);
unknown.tools[0].returns.schema = { type: "object", not: { type: "null" } };
