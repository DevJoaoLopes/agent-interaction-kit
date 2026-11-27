import type { ExecutionSide, ReturnFormat, ToolDescriptor } from "../contracts/types.js";

export interface ToolFromJsonSchemaInput {
  name: string;
  executionSide: ExecutionSide;
  description?: string;
  parameters: Record<string, unknown>;
  returns?: {
    format?: ReturnFormat;
    schema?: Record<string, unknown>;
  };
  requiresApproval?: boolean;
}

export function toolFromJsonSchema(input: ToolFromJsonSchemaInput): ToolDescriptor {
  const parametersType = input.parameters.type;
  if (parametersType !== undefined && parametersType !== "object") {
    throw new TypeError(
      `toolFromJsonSchema: parameters.type must be "object" (received ${JSON.stringify(parametersType)}).`,
    );
  }
  const tool: ToolDescriptor = {
    name: input.name,
    executionSide: input.executionSide,
    parameters: { ...input.parameters, type: "object" },
    returns: { format: input.returns?.format ?? "json" },
  };
  if (input.description !== undefined) {
    tool.description = input.description;
  }
  if (input.returns?.schema !== undefined) {
    tool.returns = { ...tool.returns, schema: input.returns.schema };
  }
  if (input.requiresApproval !== undefined) {
    tool.requiresApproval = input.requiresApproval;
  }
  return tool;
}
