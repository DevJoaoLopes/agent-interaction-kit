import type { ToolDescriptor, ToolReturnDescriptor } from "../../contracts/types.js";
import type { Diagnostic } from "../diagnostics.js";
import { findUnsupportedConstruct } from "./schema-safety.js";

const SCALAR_TYPES = new Set(["string", "number", "integer", "boolean", "null"]);

export function checkResults(
  consumerExpectedReturns: ToolReturnDescriptor | undefined,
  providerTool: ToolDescriptor,
): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  const toolName = providerTool.name;

  const providerReturns = providerTool.returns;
  const providerUnsupportedPath = findUnsupportedConstruct(providerReturns?.schema);
  const consumerUnsupportedPath = findUnsupportedConstruct(consumerExpectedReturns?.schema);
  const unsupportedPath = providerUnsupportedPath ?? consumerUnsupportedPath;

  if (unsupportedPath) {
    diagnostics.push({
      code: "AIK-SCHEMA-001",
      severity: "unknown",
      toolName,
      path: `/returns/schema${unsupportedPath}`,
      message: `Tool "${toolName}" returns schema contains unsupported construct at "${unsupportedPath}".`,
    });
    return diagnostics;
  }

  if (!consumerExpectedReturns || !consumerExpectedReturns.schema) {
    return diagnostics;
  }

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
    const cProps = (cSchema.properties as Record<string, Record<string, unknown>>) || {};
    for (const reqProp of cRequired) {
      const segment = reqProp.replace(/~/g, "~0").replace(/\//g, "~1");
      if (!(reqProp in pProps)) {
        diagnostics.push({
          code: "AIK-RESULT-002",
          severity: "error",
          toolName,
          path: `/returns/schema/properties/${segment}`,
          message: `Tool "${toolName}": consumer requires result field "${reqProp}", which is missing in provider return schema.`,
        });
      } else {
        const pField = pProps[reqProp] as Record<string, unknown> | undefined;
        const cType = cProps[reqProp]?.type;
        const pType = pField?.type;
        if (
          typeof cType === "string" &&
          typeof pType === "string" &&
          SCALAR_TYPES.has(cType) &&
          SCALAR_TYPES.has(pType) &&
          cType !== pType &&
          !(cType === "number" && pType === "integer")
        ) {
          diagnostics.push({
            code: "AIK-RESULT-003",
            severity: "error",
            toolName,
            path: `/returns/schema/properties/${segment}/type`,
            message: `Tool "${toolName}": result field "${reqProp}" type is incompatible.`,
            expected: cType,
            actual: pType,
          });
        }
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
          const segment = reqProp.replace(/~/g, "~0").replace(/\//g, "~1");
          diagnostics.push({
            code: "AIK-RESULT-002",
            severity: "error",
            toolName,
            path: `/returns/schema/items/properties/${segment}`,
            message: `Tool "${toolName}": consumer requires field "${reqProp}" on array items, but provider does not declare it.`,
          });
        }
      }
    }
  }

  return diagnostics;
}
