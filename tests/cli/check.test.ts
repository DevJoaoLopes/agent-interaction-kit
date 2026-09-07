import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { runCheck } from "../../src/cli/commands/check.js";

describe("CLI runCheck", () => {
  const tmpDir = path.resolve("./tests/cli/tmp");

  it("returns exitCode 0 on matching provider and consumer", async () => {
    fs.mkdirSync(tmpDir, { recursive: true });
    const pPath = path.join(tmpDir, "provider.json");
    const cPath = path.join(tmpDir, "consumer.json");

    fs.writeFileSync(
      pPath,
      JSON.stringify({
        schemaVersion: "1.0.0",
        producer: { name: "b", version: "1.0.0", buildId: "1" },
        protocolProfile: "ag-ui@0.1",
        contextProfile: "default",
        tools: [
          {
            name: "ping",
            executionSide: "backend",
            parameters: { type: "object" },
            returns: { format: "json" },
          },
        ],
      }),
    );

    fs.writeFileSync(
      cPath,
      JSON.stringify({
        schemaVersion: "1.0.0",
        consumer: { name: "f", version: "1.0.0", buildId: "1" },
        protocolProfile: "ag-ui@0.1",
        contextProfile: "default",
        requires: [{ toolName: "ping", executionSide: "backend" }],
      }),
    );

    const exitCode = await runCheck({
      provider: pPath,
      consumer: cPath,
      format: "json",
    });

    expect(exitCode).toBe(0);
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("returns exitCode 2 when files are missing", async () => {
    const exitCode = await runCheck({
      provider: "non-existent-provider.json",
      consumer: "non-existent-consumer.json",
      format: "json",
    });
    expect(exitCode).toBe(2);
  });
});
