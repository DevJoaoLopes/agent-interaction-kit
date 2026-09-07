import { describe, expect, it } from "vitest";
import type { CompatibilityReport } from "../../src/core/diagnostics.js";
import {
  formatJsonReport,
  formatJunitReport,
  formatTerminalReport,
} from "../../src/reporters/index.js";

describe("Reporters", () => {
  const sampleReport: CompatibilityReport = {
    status: "fail",
    contextProfile: "default",
    producerBuild: "b123",
    consumerBuild: "c456",
    checkedTools: ["searchDocuments"],
    diagnostics: [
      {
        code: "AIK-RESULT-001",
        severity: "error",
        toolName: "searchDocuments",
        message: 'Result root type mismatch: consumer expects "array", provider produces "object".',
      },
    ],
  };

  it("formats JSON report properly", () => {
    const jsonStr = formatJsonReport(sampleReport);
    const parsed = JSON.parse(jsonStr);
    expect(parsed.status).toBe("fail");
    expect(parsed.diagnostics[0].code).toBe("AIK-RESULT-001");
  });

  it("formats JUnit XML report with failure tags", () => {
    const xml = formatJunitReport(sampleReport);
    expect(xml).toContain('<testsuites name="AIK Compatibility Checks"');
    expect(xml).toContain('<failure message="Result root type mismatch');
    expect(xml).toContain('classname="AIK.searchDocuments"');
  });

  it("formats Terminal report with human readable output", () => {
    const output = formatTerminalReport(sampleReport);
    expect(output).toContain("AIK Check Failed");
    expect(output).toContain("[AIK-RESULT-001]");
    expect(output).toContain("searchDocuments");
  });
});
