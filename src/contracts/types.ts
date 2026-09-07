export type ExecutionSide = "backend" | "frontend";
export type ReturnFormat = "json" | "text" | "raw";

export interface ToolParameterSchema {
  type: "object";
  properties?: Record<string, unknown>;
  required?: string[];
  additionalProperties?: boolean;
  [key: string]: unknown;
}

export interface ToolReturnDescriptor {
  format: ReturnFormat;
  schema?: Record<string, unknown>;
}

export interface ToolDescriptor {
  name: string;
  executionSide: ExecutionSide;
  description?: string;
  parameters: ToolParameterSchema;
  returns: ToolReturnDescriptor;
  requiresApproval?: boolean;
}

export interface ProviderManifest {
  $schema?: string;
  schemaVersion: string;
  producer: {
    name: string;
    version: string;
    buildId: string;
  };
  protocolProfile: string;
  contextProfile: string;
  tools: ToolDescriptor[];
}

export interface ConsumerRequirement {
  toolName: string;
  executionSide: ExecutionSide;
  expectedParameters?: ToolParameterSchema;
  expectedReturns?: ToolReturnDescriptor;
  fallbackPolicy?: "fail-fast" | "silent-ignore";
}

export interface ConsumerExpectations {
  $schema?: string;
  schemaVersion: string;
  consumer: {
    name: string;
    version: string;
    buildId: string;
  };
  protocolProfile: string;
  contextProfile: string;
  requires: ConsumerRequirement[];
}

export type Result<T> = { ok: true; data: T } | { ok: false; errors: string[] };
