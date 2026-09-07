import type { CompatibilityReport } from "../core/diagnostics.js";

function escapeXml(unsafe: string): string {
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export function formatJunitReport(report: CompatibilityReport): string {
  const failuresCount = report.diagnostics.filter((d) => d.severity === "error").length;
  const testsCount = report.checkedTools.length || 1;

  let testCasesXml = "";
  for (const tool of report.checkedTools) {
    const toolDiags = report.diagnostics.filter((d) => d.toolName === tool);
    if (toolDiags.length === 0) {
      testCasesXml += `    <testcase classname="AIK.${tool}" name="ContractCompatibility" time="0.001" />\n`;
    } else {
      for (const diag of toolDiags) {
        testCasesXml += `    <testcase classname="AIK.${tool}" name="${diag.code}" time="0.001">\n`;
        testCasesXml += `      <failure message="${escapeXml(diag.message)}" type="${diag.code}">\n`;
        testCasesXml += `        ${escapeXml(diag.message)}\n`;
        testCasesXml += "      </failure>\n";
        testCasesXml += "    </testcase>\n";
      }
    }
  }

  return `<?xml version="1.0" encoding="UTF-8"?>
<testsuites name="AIK Compatibility Checks" tests="${testsCount}" failures="${failuresCount}" errors="0" time="0.01">
  <testsuite name="aik-contract-checks" tests="${testsCount}" failures="${failuresCount}" errors="0" time="0.01">
${testCasesXml}  </testsuite>
</testsuites>`;
}
