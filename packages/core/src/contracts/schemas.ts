export const providerManifestSchema = {
  type: "object",
  required: ["schemaVersion", "producer", "protocolProfile", "contextProfile", "tools"],
  properties: {
    $schema: { type: "string" },
    schemaVersion: { type: "string" },
    producer: {
      type: "object",
      required: ["name", "version", "buildId"],
      properties: {
        name: { type: "string" },
        version: { type: "string" },
        buildId: { type: "string" },
      },
    },
    protocolProfile: { type: "string" },
    contextProfile: { type: "string" },
    tools: {
      type: "array",
      items: {
        type: "object",
        required: ["name", "executionSide", "parameters", "returns"],
        properties: {
          name: { type: "string" },
          executionSide: { enum: ["backend", "frontend"] },
          description: { type: "string" },
          parameters: { type: "object" },
          returns: {
            type: "object",
            required: ["format"],
            properties: {
              format: { enum: ["json", "text", "raw"] },
              schema: { type: "object" },
            },
          },
          requiresApproval: { type: "boolean" },
        },
      },
    },
  },
};

export const consumerExpectationsSchema = {
  type: "object",
  required: ["schemaVersion", "consumer", "protocolProfile", "contextProfile", "requires"],
  properties: {
    $schema: { type: "string" },
    schemaVersion: { type: "string" },
    consumer: {
      type: "object",
      required: ["name", "version", "buildId"],
      properties: {
        name: { type: "string" },
        version: { type: "string" },
        buildId: { type: "string" },
      },
    },
    protocolProfile: { type: "string" },
    contextProfile: { type: "string" },
    requires: {
      type: "array",
      items: {
        type: "object",
        required: ["toolName", "executionSide"],
        properties: {
          toolName: { type: "string" },
          executionSide: { enum: ["backend", "frontend"] },
          expectedParameters: { type: "object" },
          expectedReturns: {
            type: "object",
            properties: {
              format: { enum: ["json", "text", "raw"] },
              schema: { type: "object" },
            },
          },
          fallbackPolicy: { enum: ["fail-fast", "silent-ignore"] },
        },
      },
    },
  },
};
