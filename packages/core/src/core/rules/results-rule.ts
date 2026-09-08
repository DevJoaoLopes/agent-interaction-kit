import type { ToolDescriptor, ToolReturnDescriptor } from "../../contracts/types.js";
import type { Diagnostic } from "../diagnostics.js";

export function checkResults(
  consumerExpectedReturns: ToolReturnDescriptor | undefined,
  providerTool: ToolDescriptor,
): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  const toolName = providerTool.name;

  if (!consumerExpectedReturns || !consumerExpectedReturns.schema) {
    return diagnostics;
  }

  const providerReturns = providerTool.returns;
  if (!providerReturns || !providerReturns.schema) {
    diagnostics.push({
      code: "AIK-RESULT-001",
      severity: "error",
      toolName,
      message: `Tool "${toolName}": consumer expects structured return schema, but provider declares none.`,
    });
    return diagnostics;
  }

  const cSchema = consumerExpectedReturns.schema as Record<string, unknown>;
  const pSchema = providerReturns.schema as Record<string, unknown>;

  // Detect unsupported schema constructs
  if ("not" in cSchema || "not" in pSchema) {
    diagnostics.push({
      code: "AIK-SCHEMA-001",
      severity: "unknown",
      toolName,
      message: `Tool "${toolName}" returns schema contains unsupported "not" construct.`,
    });
    return diagnostics;
  }

  // Root type check (e.g. array vs object)
  if (cSchema.type && pSchema.type && cSchema.type !== pSchema.type) {
    diagnostics.push({
      code: "AIK-RESULT-001",
      severity: "error",
      toolName,
      path: "/returns/schema/type",
      message: `Tool "${toolName}": result root type mismatch. Consumer expects "${cSchema.type}", but provider produces "${pSchema.type}".`,
      expected: cSchema.type,
      actual: pSchema.type,
    });
    return diagnostics;
  }

  // Required properties check for object returns
  if (cSchema.type === "object" && pSchema.type === "object") {
    const cRequired = (cSchema.required as string[]) || [];
    const pProps = (pSchema.properties as Record<string, unknown>) || {};
    for (const reqProp of cRequired) {
      if (!(reqProp in pProps)) {
        diagnostics.push({
          code: "AIK-RESULT-002",
          severity: "error",
          toolName,
          path: `/returns/schema/properties/${reqProp}`,
          message: `Tool "${toolName}": consumer requires result field "${reqProp}", which is missing in provider return schema.`,
        });
      }
    }
  }

  // Required properties for items in array returns
  if (cSchema.type === "array" && pSchema.type === "array") {
    const cItems = (cSchema.items as Record<string, unknown>) || {};
    const pItems = (pSchema.items as Record<string, unknown>) || {};
    if (cItems.type === "object" && pItems.type === "object") {
      const cItemRequired = (cItems.required as string[]) || [];
      const pItemProps = (pItems.properties as Record<string, unknown>) || {};
      for (const reqProp of cItemRequired) {
        if (!(reqProp in pItemProps)) {
          diagnostics.push({
            code: "AIK-RESULT-002",
            severity: "error",
            toolName,
            path: `/returns/schema/items/properties/${reqProp}`,
            message: `Tool "${toolName}": consumer requires field "${reqProp}" on array items, but provider does not declare it.`,
          });
        }
      }
    }
  }

  return diagnostics;
}
