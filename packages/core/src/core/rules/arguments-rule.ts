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

  // Directional evaluation:
  // When executionSide === "backend", the caller/emitter is the consumer (frontend),
  // and the callee/receptor is the provider (backend).
  // When executionSide === "frontend", the caller/emitter is the provider (backend),
  // and the callee/receptor is the consumer (frontend).
  const emitterParams = isServerExecution ? consumerExpectedParams : providerTool.parameters;
  const receptorParams = isServerExecution ? providerTool.parameters : consumerExpectedParams;
  const emitterSide = isServerExecution ? "consumer" : "provider";
  const receptorSide = isServerExecution ? "provider" : "consumer";

  // 1. Mandatory Arguments (AIK-INPUT-001)
  // Callee/receptor required parameters must be declared or guaranteed by caller/emitter.
  const receptorRequired = receptorParams.required || [];
  const emitterProperties = Object.keys(emitterParams.properties || {});
  const emitterRequired = emitterParams.required || [];

  for (const reqField of receptorRequired) {
    if (!emitterProperties.includes(reqField) && !emitterRequired.includes(reqField)) {
      diagnostics.push({
        code: "AIK-INPUT-001",
        severity: "error",
        toolName,
        path: `/parameters/required/${reqField}`,
        message: `Tool "${toolName}": ${receptorSide} requires mandatory argument "${reqField}", which ${emitterSide} does not declare.`,
      });
    }
  }

  // 2. Enum Contravariance (AIK-INPUT-002)
  // Caller/emitter must not supply an enum value that is unaccepted by callee/receptor.
  const emitterProps = (emitterParams.properties || {}) as Record<
    string,
    { enum?: unknown[]; type?: string }
  >;
  const receptorProps = (receptorParams.properties || {}) as Record<
    string,
    { enum?: unknown[]; type?: string }
  >;

  for (const [propName, receptorProp] of Object.entries(receptorProps)) {
    if (Array.isArray(receptorProp.enum)) {
      const emitterProp = emitterProps[propName];
      if (emitterProp && Array.isArray(emitterProp.enum)) {
        const unacceptedValues = emitterProp.enum.filter(
          (val) => !receptorProp.enum?.includes(val),
        );
        if (unacceptedValues.length > 0) {
          diagnostics.push({
            code: "AIK-INPUT-002",
            severity: "error",
            toolName,
            path: `/parameters/properties/${propName}/enum`,
            message: `Tool "${toolName}": argument "${propName}" enum mismatch. ${emitterSide} allows unaccepted value(s): ${unacceptedValues.map((v) => JSON.stringify(v)).join(", ")}.`,
          });
        }
      } else if (emitterProp && emitterProp.type === "string" && !emitterProp.enum) {
        diagnostics.push({
          code: "AIK-INPUT-002",
          severity: "error",
          toolName,
          path: `/parameters/properties/${propName}/enum`,
          message: `Tool "${toolName}": argument "${propName}" enum mismatch. ${receptorSide} restricts to enum [${receptorProp.enum.map((v) => JSON.stringify(v)).join(", ")}], but ${emitterSide} does not restrict allowed values.`,
        });
      }
    }
  }

  return diagnostics;
}
