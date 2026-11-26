import type { ToolDescriptor, ToolReturnDescriptor } from "../../contracts/types.js";
import type { Diagnostic } from "../diagnostics.js";
import { readerConstIsGuaranteed, schemaHasType, schemaTypesEqual } from "../schema-types.js";
import { findUnsupportedConstruct } from "./schema-safety.js";

const ROOT_PATH = "/returns/schema";
const SCALAR_TYPES = new Set(["string", "number", "integer", "boolean", "null"]);

function pointerSegment(name: string): string {
  return name.replace(/~/g, "~0").replace(/\//g, "~1");
}

function isScalarType(type: unknown): type is string {
  return typeof type === "string" && SCALAR_TYPES.has(type);
}

function scalarsIncompatible(readerType: unknown, producerType: unknown): boolean {
  if (!isScalarType(readerType) || !isScalarType(producerType)) {
    return false;
  }
  return readerType !== producerType && !(readerType === "number" && producerType === "integer");
}

function checkSchemaPair(
  cSchema: Record<string, unknown>,
  pSchema: Record<string, unknown>,
  basePath: string,
  toolName: string,
  diagnostics: Diagnostic[],
  fieldName?: string,
): void {
  if (cSchema.type && pSchema.type && !schemaTypesEqual(cSchema.type, pSchema.type)) {
    if (basePath !== ROOT_PATH && scalarsIncompatible(cSchema.type, pSchema.type)) {
      diagnostics.push({
        code: "AIK-RESULT-003",
        severity: "error",
        toolName,
        path: `${basePath}/type`,
        message: fieldName
          ? `Tool "${toolName}": result field "${fieldName}" type is incompatible.`
          : `Tool "${toolName}": result field type is incompatible.`,
        expected: cSchema.type,
        actual: pSchema.type,
      });
      return;
    }
    if (basePath === ROOT_PATH || !(isScalarType(cSchema.type) && isScalarType(pSchema.type))) {
      diagnostics.push({
        code: "AIK-RESULT-001",
        severity: "error",
        toolName,
        path: `${basePath}/type`,
        message: `Tool "${toolName}": result root type mismatch. Consumer expects "${cSchema.type}", but provider produces "${pSchema.type}".`,
        expected: cSchema.type,
        actual: pSchema.type,
      });
      return;
    }
  }

  if (!readerConstIsGuaranteed(cSchema, pSchema)) {
    diagnostics.push({
      code: "AIK-RESULT-001",
      severity: "error",
      toolName,
      path: `${basePath}/const`,
      message: fieldName
        ? `Tool "${toolName}": result field "${fieldName}" const is incompatible.`
        : `Tool "${toolName}": result const is incompatible.`,
      expected: cSchema.const,
      actual: Object.hasOwn(pSchema, "const") ? pSchema.const : undefined,
    });
  }

  if (schemaHasType(cSchema.type, "object") && schemaHasType(pSchema.type, "object")) {
    const cRequired = (cSchema.required as string[]) || [];
    const pRequired = new Set((pSchema.required as string[]) || []);
    const pProps = (pSchema.properties as Record<string, unknown>) || {};
    const cProps = (cSchema.properties as Record<string, Record<string, unknown>>) || {};
    for (const reqProp of cRequired) {
      const segment = pointerSegment(reqProp);
      const fieldPath = `${basePath}/properties/${segment}`;
      if (!(reqProp in pProps)) {
        diagnostics.push({
          code: "AIK-RESULT-002",
          severity: "error",
          toolName,
          path: fieldPath,
          message: `Tool "${toolName}": consumer requires result field "${reqProp}", which is missing in provider return schema.`,
        });
        continue;
      }
      if (!pRequired.has(reqProp)) {
        diagnostics.push({
          code: "AIK-RESULT-002",
          severity: "error",
          toolName,
          path: fieldPath,
          message: `Tool "${toolName}": consumer requires result field "${reqProp}", but the provider declares it as optional.`,
        });
        continue;
      }
      const pField = pProps[reqProp];
      const cField = cProps[reqProp];
      if (
        pField &&
        typeof pField === "object" &&
        cField &&
        typeof cField === "object" &&
        !Array.isArray(pField) &&
        !Array.isArray(cField)
      ) {
        checkSchemaPair(
          cField,
          pField as Record<string, unknown>,
          fieldPath,
          toolName,
          diagnostics,
          reqProp,
        );
      }
    }
  }

  if (schemaHasType(cSchema.type, "array") && schemaHasType(pSchema.type, "array")) {
    const cItems = cSchema.items;
    const pItems = pSchema.items;
    if (
      cItems &&
      typeof cItems === "object" &&
      !Array.isArray(cItems) &&
      pItems &&
      typeof pItems === "object" &&
      !Array.isArray(pItems)
    ) {
      checkSchemaPair(
        cItems as Record<string, unknown>,
        pItems as Record<string, unknown>,
        `${basePath}/items`,
        toolName,
        diagnostics,
      );
    }
  }
}

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

  if (
    consumerExpectedReturns?.format &&
    providerReturns?.format &&
    consumerExpectedReturns.format !== providerReturns.format
  ) {
    diagnostics.push({
      code: "AIK-RESULT-004",
      severity: "error",
      toolName,
      path: "/returns/format",
      message: `Tool "${toolName}": result format mismatch. Consumer expects "${consumerExpectedReturns.format}", but provider produces "${providerReturns.format}".`,
      expected: consumerExpectedReturns.format,
      actual: providerReturns.format,
    });
  }

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

  checkSchemaPair(
    consumerExpectedReturns.schema as Record<string, unknown>,
    providerReturns.schema as Record<string, unknown>,
    ROOT_PATH,
    toolName,
    diagnostics,
  );

  return diagnostics;
}
