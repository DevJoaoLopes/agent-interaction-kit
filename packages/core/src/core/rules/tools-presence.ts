import type { ConsumerRequirement, ProviderManifest } from "../../contracts/types.js";
import type { Diagnostic } from "../diagnostics.js";

export function checkToolPresence(
  req: ConsumerRequirement,
  provider: ProviderManifest,
): { matchedTool?: ProviderManifest["tools"][0]; diagnostics: Diagnostic[] } {
  const diagnostics: Diagnostic[] = [];
  const found = provider.tools.find((t) => t.name === req.toolName);

  if (!found) {
    diagnostics.push({
      code: "AIK-TOOL-001",
      severity: "error",
      toolName: req.toolName,
      message: `Required tool "${req.toolName}" is not provided by the backend manifest.`,
    });
    return { diagnostics };
  }

  if (found.executionSide !== req.executionSide) {
    diagnostics.push({
      code: "AIK-TOOL-002",
      severity: "error",
      toolName: req.toolName,
      message: `Tool "${req.toolName}" execution side mismatch: consumer expected "${req.executionSide}", provider declared "${found.executionSide}".`,
      expected: req.executionSide,
      actual: found.executionSide,
    });
  }

  return { matchedTool: found, diagnostics };
}
