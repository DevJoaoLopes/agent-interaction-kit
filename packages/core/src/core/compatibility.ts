import type { ConsumerExpectations, ProviderManifest } from "../contracts/types.js";
import type { CompatibilityReport, Diagnostic } from "./diagnostics.js";
import { checkArguments } from "./rules/arguments-rule.js";
import { checkResults } from "./rules/results-rule.js";
import { checkToolPresence } from "./rules/tools-presence.js";

export function evaluateCompatibility(
  provider: ProviderManifest,
  consumer: ConsumerExpectations,
  contextProfile = "default",
): CompatibilityReport {
  const allDiagnostics: Diagnostic[] = [];
  const checkedTools: string[] = [];

  for (const req of consumer.requires) {
    checkedTools.push(req.toolName);
    const presence = checkToolPresence(req, provider);
    allDiagnostics.push(...presence.diagnostics);

    if (presence.matchedTool) {
      const argDiags = checkArguments(req.expectedParameters, presence.matchedTool);
      allDiagnostics.push(...argDiags);

      const resDiags = checkResults(req.expectedReturns, presence.matchedTool);
      allDiagnostics.push(...resDiags);
    }
  }

  let status: CompatibilityReport["status"] = "pass";
  if (allDiagnostics.some((d) => d.severity === "error")) {
    status = "fail";
  } else if (allDiagnostics.some((d) => d.severity === "unknown")) {
    status = "unknown";
  }

  return {
    status,
    contextProfile,
    producerBuild: provider.producer.buildId,
    consumerBuild: consumer.consumer.buildId,
    checkedTools,
    diagnostics: allDiagnostics,
  };
}
