import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import { runCheck } from "../../src/cli/commands/check.js";
import type { ConsumerExpectations, ProviderManifest } from "../../src/contracts/types.js";
import { evaluateCompatibility } from "../../src/core/compatibility.js";

function pair(
  providerContext: string,
  consumerContext: string,
): { provider: ProviderManifest; consumer: ConsumerExpectations } {
  return {
    provider: {
      schemaVersion: "1.0.0",
      producer: { name: "backend", version: "1.0.0", buildId: "b1" },
      protocolProfile: "ag-ui@0.1",
      contextProfile: providerContext,
      tools: [
        {
          name: "ping",
          executionSide: "backend",
          parameters: { type: "object", properties: {} },
          returns: { format: "json" },
        },
      ],
    },
    consumer: {
      schemaVersion: "1.0.0",
      consumer: { name: "frontend", version: "1.0.0", buildId: "c1" },
      protocolProfile: "ag-ui@0.1",
      contextProfile: consumerContext,
      requires: [{ toolName: "ping", executionSide: "backend" }],
    },
  };
}

describe("context profile compatibility", () => {
  it("fails with AIK-CONTEXT-001 when the manifests declare different context profiles", () => {
    const { provider, consumer } = pair("production", "staging");
    const report = evaluateCompatibility(provider, consumer);
    expect(report.status).toBe("fail");
    const diag = report.diagnostics.find((item) => item.code === "AIK-CONTEXT-001");
    expect(diag).toBeDefined();
    expect(diag?.severity).toBe("error");
    expect(diag?.path).toBe("/contextProfile");
    expect(diag?.expected).toBe("staging");
    expect(diag?.actual).toBe("production");
  });

  it("still evaluates the tools when the context profiles differ", () => {
    const { provider, consumer } = pair("production", "staging");
    consumer.requires.push({ toolName: "missing", executionSide: "backend" });
    const report = evaluateCompatibility(provider, consumer);
    expect(report.diagnostics.map((item) => item.code).sort()).toEqual([
      "AIK-CONTEXT-001",
      "AIK-TOOL-001",
    ]);
    expect(report.checkedTools).toEqual(["ping", "missing"]);
  });

  it("passes when both manifests declare the same context profile", () => {
    const { provider, consumer } = pair("production", "production");
    const report = evaluateCompatibility(provider, consumer);
    expect(report.status).toBe("pass");
    expect(report.diagnostics).toEqual([]);
  });

  it("exits with 1, not 2, when the context profiles differ", async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "aik-context-"));
    const { provider, consumer } = pair("production", "staging");
    const providerPath = path.join(dir, "provider.json");
    const consumerPath = path.join(dir, "consumer.json");
    fs.writeFileSync(providerPath, JSON.stringify(provider));
    fs.writeFileSync(consumerPath, JSON.stringify(consumer));
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    try {
      const exitCode = await runCheck({
        provider: providerPath,
        consumer: consumerPath,
        format: "json",
      });
      expect(exitCode).toBe(1);
    } finally {
      log.mockRestore();
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});
