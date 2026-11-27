import { describe, expect, it } from "vitest";
import type { CompatibilityReport } from "../../src/core/diagnostics.js";
import { formatJunitReport } from "../../src/reporters/junit.js";

describe("JUnit report with manifest-level diagnostics", () => {
  const report: CompatibilityReport = {
    status: "fail",
    contextProfile: "default",
    producerBuild: "b1",
    consumerBuild: "c1",
    checkedTools: ["ping"],
    diagnostics: [
      {
        code: "AIK-CONTEXT-001",
        severity: "error",
        toolName: "(manifest)",
        path: "/contextProfile",
        message:
          'Context profile mismatch. Consumer expects "staging", but provider declares "production".',
      },
    ],
  };

  it("emits a failing testcase for a diagnostic that does not belong to a checked tool", () => {
    const xml = formatJunitReport(report);
    expect(xml).toContain('failures="1"');
    expect(xml).toContain('classname="AIK.(manifest)" name="AIK-CONTEXT-001"');
    expect(xml).toContain('<failure message="Context profile mismatch.');
    expect(xml).toContain('<testsuite name="aik-contract-checks" tests="2" failures="1"');
  });

  it("keeps the passing testcase of the checked tool", () => {
    const xml = formatJunitReport(report);
    expect(xml).toContain('<testcase classname="AIK.ping" name="ContractCompatibility"');
  });
});
