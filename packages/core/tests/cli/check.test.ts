import fs from "node:fs";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
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

  it("formats root-level validation errors with a readable location", async () => {
    fs.mkdirSync(tmpDir, { recursive: true });
    const pPath = path.join(tmpDir, "provider.json");
    const cPath = path.join(tmpDir, "consumer.json");
    fs.writeFileSync(pPath, "{}");
    fs.writeFileSync(cPath, "{}");
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);

    const exitCode = await runCheck({ provider: pPath, consumer: cPath });

    expect(exitCode).toBe(2);
    expect(consoleError).toHaveBeenCalledWith(
      expect.stringContaining("Validation error at (root):"),
    );
    consoleError.mockRestore();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("creates nested parent directories when writing report to output file", async () => {
    fs.mkdirSync(tmpDir, { recursive: true });
    const pPath = path.join(tmpDir, "provider.json");
    const cPath = path.join(tmpDir, "consumer.json");
    const nestedOut = path.join(tmpDir, "nested", "sub", "report.junit.xml");

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
      format: "junit",
      output: nestedOut,
    });

    expect(exitCode).toBe(0);
    expect(fs.existsSync(nestedOut)).toBe(true);
    const content = fs.readFileSync(nestedOut, "utf-8");
    expect(content).toContain('<testsuite name="aik-contract-checks"');
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });
});
