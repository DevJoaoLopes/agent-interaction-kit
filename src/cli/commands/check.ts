import fs from "node:fs";
import path from "node:path";
import { parseConsumerExpectations, parseProviderManifest } from "../../contracts/parser.js";
import { evaluateCompatibility } from "../../core/compatibility.js";
import {
  formatJsonReport,
  formatJunitReport,
  formatTerminalReport,
} from "../../reporters/index.js";

export interface CheckCommandOptions {
  provider: string;
  consumer: string;
  context?: string;
  format?: "terminal" | "json" | "junit";
  output?: string;
  strict?: boolean;
}

export async function runCheck(options: CheckCommandOptions): Promise<number> {
  const format = options.format || "terminal";
  const context = options.context || "default";

  if (!fs.existsSync(options.provider) || !fs.existsSync(options.consumer)) {
    console.error(
      `[AIK-ERROR] Manifest file(s) not found: provider: "${options.provider}", consumer: "${options.consumer}"`,
    );
    return 2;
  }

  const pContent = fs.readFileSync(options.provider, "utf-8");
  const cContent = fs.readFileSync(options.consumer, "utf-8");

  const pResult = parseProviderManifest(pContent);
  if (!pResult.ok) {
    console.error(`[AIK-ERROR] Failed to parse provider manifest:\n${pResult.errors.join("\n")}`);
    return 2;
  }

  const cResult = parseConsumerExpectations(cContent);
  if (!cResult.ok) {
    console.error(
      `[AIK-ERROR] Failed to parse consumer expectations:\n${cResult.errors.join("\n")}`,
    );
    return 2;
  }

  const report = evaluateCompatibility(pResult.data, cResult.data, context);

  let formatted = "";
  if (format === "json") {
    formatted = formatJsonReport(report);
  } else if (format === "junit") {
    formatted = formatJunitReport(report);
  } else {
    formatted = formatTerminalReport(report);
  }

  if (options.output) {
    const outputDir = path.dirname(options.output);
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
    fs.writeFileSync(options.output, formatted, "utf-8");
  } else {
    console.log(formatted);
  }

  if (report.status === "fail") {
    return 1;
  }
  if (report.status === "unknown" && options.strict) {
    return 2;
  }
  return 0;
}
