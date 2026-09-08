import type { CompatibilityReport } from "../core/diagnostics.js";

export function formatJsonReport(report: CompatibilityReport): string {
  return JSON.stringify(report, null, 2);
}
