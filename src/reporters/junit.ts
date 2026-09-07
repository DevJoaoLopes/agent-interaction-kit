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

  let testCasesXml = "";
  let testsCount = 0;

  for (const tool of report.checkedTools) {
    const escapedTool = escapeXml(tool);
    const toolDiags = report.diagnostics.filter((d) => d.toolName === tool);

    if (toolDiags.length === 0) {
      testCasesXml += `    <testcase classname="AIK.${escapedTool}" name="ContractCompatibility" time="0.001" />\n`;
      testsCount += 1;
    } else {
      for (const diag of toolDiags) {
        testsCount += 1;
        const escapedCode = escapeXml(diag.code);
        const escapedMsg = escapeXml(diag.message);

        testCasesXml += `    <testcase classname="AIK.${escapedTool}" name="${escapedCode}" time="0.001">\n`;
        if (diag.severity === "error") {
          testCasesXml += `      <failure message="${escapedMsg}" type="${escapedCode}">\n`;
          testCasesXml += `        ${escapedMsg}\n`;
          testCasesXml += "      </failure>\n";
        } else {
          testCasesXml += `      <warning message="${escapedMsg}" type="${escapedCode}">\n`;
          testCasesXml += `        ${escapedMsg}\n`;
          testCasesXml += "      </warning>\n";
        }
        testCasesXml += "    </testcase>\n";
      }
    }
  }

  if (testsCount === 0) {
    testCasesXml = '    <testcase classname="AIK" name="ContractCompatibility" time="0.001" />\n';
    testsCount = 1;
  }

  return `<?xml version="1.0" encoding="UTF-8"?>
<testsuites name="AIK Compatibility Checks" tests="${testsCount}" failures="${failuresCount}" errors="0" time="0.01">
  <testsuite name="aik-contract-checks" tests="${testsCount}" failures="${failuresCount}" errors="0" time="0.01">
${testCasesXml}  </testsuite>
</testsuites>`;
}
