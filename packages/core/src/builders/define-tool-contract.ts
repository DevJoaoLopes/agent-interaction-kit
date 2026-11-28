import type { StandardJSONSchemaV1, StandardSchemaV1 } from "@standard-schema/spec";
import type {
  ConsumerRequirement,
  ExecutionSide,
  ToolParameterSchema,
} from "../contracts/types.js";
import { toJsonSchema } from "../standard-schema/to-json-schema.js";

export type ToolContractSchema = StandardSchemaV1 & StandardJSONSchemaV1;

export interface DefineToolContractInput<
  P extends ToolContractSchema,
  R extends ToolContractSchema | undefined = undefined,
> {
  name: string;
  description?: string;
  executionSide?: ExecutionSide;
  parameters: P;
  returns?: R;
  fallbackPolicy?: ConsumerRequirement["fallbackPolicy"];
}

export interface ToolContract<P extends ToolContractSchema> {
  tool: { name: string; description?: string; parameters: P };
  requirement: ConsumerRequirement;
}

function convert(
  schema: ToolContractSchema,
  io: "input" | "output",
  name: string,
  label: string,
): Record<string, unknown> {
  const result = toJsonSchema(schema, io);
  if (!result.ok) {
    throw new TypeError(
      `defineToolContract: ${label} of tool "${name}": ${result.errors.join(" ")}`,
    );
  }
  return result.data;
}

export function defineToolContract<
  P extends ToolContractSchema,
  R extends ToolContractSchema | undefined = undefined,
>(input: DefineToolContractInput<P, R>): ToolContract<P> {
  const parameters = convert(input.parameters, "input", input.name, "parameters");
  if (parameters.type !== "object") {
    throw new TypeError(
      `defineToolContract: parameters of tool "${input.name}" must be an object schema.`,
    );
  }
  const requirement: ConsumerRequirement = {
    toolName: input.name,
    executionSide: input.executionSide ?? "frontend",
    expectedParameters: parameters as ToolParameterSchema,
  };
  if (input.returns !== undefined) {
    requirement.expectedReturns = {
      format: "json",
      schema: convert(input.returns, "output", input.name, "returns"),
    };
  }
  if (input.fallbackPolicy !== undefined) {
    requirement.fallbackPolicy = input.fallbackPolicy;
  }
  const tool: ToolContract<P>["tool"] = { name: input.name, parameters: input.parameters };
  if (input.description !== undefined) {
    tool.description = input.description;
  }
  return { tool, requirement };
}
