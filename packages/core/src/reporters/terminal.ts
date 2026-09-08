import chalk from "chalk";
import type { CompatibilityReport } from "../core/diagnostics.js";

export function formatTerminalReport(report: CompatibilityReport): string {
  const lines: string[] = [];

  if (report.status === "pass") {
    lines.push(
      chalk.green.bold(
        `✔ AIK Check Passed: all tools compatible (context: "${report.contextProfile}")`,
      ),
    );
  } else if (report.status === "fail") {
    lines.push(
      chalk.red.bold(
        `✖ AIK Check Failed: ${report.diagnostics.length} issue(s) detected (context: "${report.contextProfile}")`,
      ),
    );
  } else {
    lines.push(
      chalk.yellow.bold(
        `⚠ AIK Check Inconclusive (UNKNOWN): requires review (context: "${report.contextProfile}")`,
      ),
    );
  }

  lines.push(
    chalk.dim(
      `  Producer Build: ${report.producerBuild} | Consumer Build: ${report.consumerBuild}`,
    ),
  );
  lines.push("");

  for (const diag of report.diagnostics) {
    const color = diag.severity === "error" ? chalk.red : chalk.yellow;
    lines.push(color(`  [${diag.code}] ${diag.toolName}`));
    lines.push(`    → ${diag.message}`);
    if (diag.path) {
      lines.push(chalk.dim(`      Location: ${diag.path}`));
    }
    lines.push("");
  }

  lines.push(
    chalk.dim(
      `Summary: ${report.checkedTools.length} tools checked, ${report.diagnostics.length} diagnostics.`,
    ),
  );

  return lines.join("\n");
}
