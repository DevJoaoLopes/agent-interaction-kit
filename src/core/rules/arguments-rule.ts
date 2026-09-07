import type { ToolDescriptor, ToolParameterSchema } from "../../contracts/types.js";
import type { Diagnostic } from "../diagnostics.js";

export function checkArguments(
  consumerExpectedParams: ToolParameterSchema | undefined,
  providerTool: ToolDescriptor,
): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  const toolName = providerTool.name;
  const isServerExecution = providerTool.executionSide === "backend";

  // Check for unsupported schema constructs
  const checkUnsupported = (schema?: Record<string, unknown>): boolean => {
    if (!schema) return false;
    return "not" in schema || "patternProperties" in schema;
  };

  if (checkUnsupported(providerTool.parameters) || checkUnsupported(consumerExpectedParams)) {
    diagnostics.push({
      code: "AIK-SCHEMA-001",
      severity: "unknown",
      toolName,
      message: `Tool "${toolName}" parameters schema contains complex construct (not, patternProperties) outside supported subset.`,
    });
    return diagnostics;
  }

  if (!consumerExpectedParams) {
    return diagnostics;
  }

  if (isServerExecution) {
    // When executing on backend, consumer calls tool.
    // Provider's required parameters must be supported by the consumer.
    const providerRequired = providerTool.parameters.required || [];
    const consumerProperties = Object.keys(consumerExpectedParams.properties || {});
    const consumerRequired = consumerExpectedParams.required || [];

    for (const reqField of providerRequired) {
      if (!consumerProperties.includes(reqField) && !consumerRequired.includes(reqField)) {
        diagnostics.push({
          code: "AIK-INPUT-001",
          severity: "error",
          toolName,
          path: `/parameters/required/${reqField}`,
          message: `Tool "${toolName}": provider requires mandatory argument "${reqField}", which consumer does not declare.`,
        });
      }
    }
  }

  return diagnostics;
}
