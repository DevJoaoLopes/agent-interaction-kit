import { toolFromJsonSchema } from "../builders/tool-from-json-schema.js";
import type { ExecutionSide, ToolDescriptor } from "../contracts/types.js";

export interface AgUiToolLike {
  name: string;
  description?: string;
  parameters?: unknown;
  metadata?: unknown;
}

export interface FromAgUiToolsOptions {
  executionSide?: ExecutionSide;
}

function toParameters(tool: AgUiToolLike): Record<string, unknown> {
  const parameters = tool.parameters;
  if (parameters === undefined || parameters === null) {
    return { type: "object", properties: {} };
  }
  if (typeof parameters !== "object" || Array.isArray(parameters)) {
    throw new TypeError(
      `fromAgUiTools: parameters must be a JSON Schema object for tool "${tool.name}".`,
    );
  }
  const schema = parameters as Record<string, unknown>;
  return Object.keys(schema).length === 0 ? { type: "object", properties: {} } : schema;
}

export function fromAgUiTools(
  tools: readonly AgUiToolLike[],
  options: FromAgUiToolsOptions = {},
): ToolDescriptor[] {
  const executionSide = options.executionSide ?? "frontend";
  return tools.map((tool) =>
    toolFromJsonSchema({
      name: tool.name,
      executionSide,
      ...(tool.description ? { description: tool.description } : {}),
      parameters: toParameters(tool),
    }),
  );
}
