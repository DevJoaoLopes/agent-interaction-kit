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
    expect(xml).toContain('tests="1" failures="1"');
  });

  it("formats JUnit XML report with warning tags and escapes XML characters", () => {
    const warningReport: CompatibilityReport = {
      status: "unknown",
      contextProfile: "default",
      producerBuild: "b123",
      consumerBuild: "c456",
      checkedTools: ["search<Special>&Tools"],
      diagnostics: [
        {
          code: "AIK-SCHEMA-001",
          severity: "unknown",
          toolName: "search<Special>&Tools",
          message: 'Unsupported construct with <special> & "quotes"',
        },
      ],
    };

    const xml = formatJunitReport(warningReport);
    expect(xml).toContain('classname="AIK.search&lt;Special&gt;&amp;Tools"');
    expect(xml).toContain(
      '<warning message="Unsupported construct with &lt;special&gt; &amp; &quot;quotes&quot;"',
    );
    expect(xml).not.toContain("<failure");
    expect(xml).toContain('tests="1" failures="0"');
  });

  it("accurately counts multiple testcases and failures in JUnit report", () => {
    const multiReport: CompatibilityReport = {
      status: "fail",
      contextProfile: "default",
      producerBuild: "b1",
      consumerBuild: "c1",
      checkedTools: ["toolA", "toolB"],
      diagnostics: [
        {
          code: "AIK-INPUT-001",
          severity: "error",
          toolName: "toolA",
          message: "Missing arg",
        },
        {
          code: "AIK-INPUT-002",
          severity: "error",
          toolName: "toolA",
          message: "Enum mismatch",
        },
      ],
    };

    const xml = formatJunitReport(multiReport);
    // toolA has 2 diagnostics, toolB has 0 diagnostics (passes as 1 testcase) -> total 3 testcases
    expect(xml).toContain('tests="3" failures="2"');
    const testcaseMatches = xml.match(/<testcase /g);
    expect(testcaseMatches).toHaveLength(3);
  });

  it("formats Terminal report with human readable output", () => {
    const output = formatTerminalReport(sampleReport);
    expect(output).toContain("AIK Check Failed");
    expect(output).toContain("[AIK-RESULT-001]");
    expect(output).toContain("searchDocuments");
  });
});
