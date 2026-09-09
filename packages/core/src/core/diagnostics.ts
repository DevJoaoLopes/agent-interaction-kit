export type DiagnosticCode =
  | "AIK-TOOL-001"
  | "AIK-TOOL-002"
  | "AIK-INPUT-001"
  | "AIK-INPUT-002"
  | "AIK-RESULT-001"
  | "AIK-RESULT-002"
  | "AIK-SCHEMA-001";

export interface Diagnostic {
  code: DiagnosticCode;
  severity: "error" | "warning" | "unknown";
  toolName: string;
  message: string;
  path?: string;
  expected?: unknown;
  actual?: unknown;
}

export type CompatibilityStatus = "pass" | "fail" | "unknown";

export interface CompatibilityReport {
  status: CompatibilityStatus;
  contextProfile: string;
  producerBuild: string;
  consumerBuild: string;
  checkedTools: string[];
  diagnostics: Diagnostic[];
}
