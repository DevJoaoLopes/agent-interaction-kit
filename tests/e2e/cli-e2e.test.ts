import path from "node:path";
import { describe, expect, it } from "vitest";
import { runCheck } from "../../src/cli/commands/check.js";

describe("E2E Fixture Verification", () => {
  const fixturesDir = path.resolve("./fixtures");

  it("Scenario 1 (Valid): returns exit code 0", async () => {
    const code = await runCheck({
      provider: path.join(fixturesDir, "valid/provider.json"),
      consumer: path.join(fixturesDir, "valid/consumer.json"),
      format: "json",
    });
    expect(code).toBe(0);
  });

  it("Scenario 2 (Breaking Result): returns exit code 1", async () => {
    const code = await runCheck({
      provider: path.join(fixturesDir, "breaking-result/provider.json"),
      consumer: path.join(fixturesDir, "breaking-result/consumer.json"),
      format: "json",
    });
    expect(code).toBe(1);
  });

  it("Scenario 3 (Breaking Args): returns exit code 1", async () => {
    const code = await runCheck({
      provider: path.join(fixturesDir, "breaking-args/provider.json"),
      consumer: path.join(fixturesDir, "breaking-args/consumer.json"),
      format: "json",
    });
    expect(code).toBe(1);
  });

  it("Scenario 4 (Missing Tool): returns exit code 1", async () => {
    const code = await runCheck({
      provider: path.join(fixturesDir, "missing-tool/provider.json"),
      consumer: path.join(fixturesDir, "missing-tool/consumer.json"),
      format: "json",
    });
    expect(code).toBe(1);
  });

  it("Scenario 5 (Unknown Schema): returns exit code 0 without strict, 2 with strict", async () => {
    const codeNonStrict = await runCheck({
      provider: path.join(fixturesDir, "unknown-schema/provider.json"),
      consumer: path.join(fixturesDir, "unknown-schema/consumer.json"),
      format: "json",
      strict: false,
    });
    expect(codeNonStrict).toBe(0);

    const codeStrict = await runCheck({
      provider: path.join(fixturesDir, "unknown-schema/provider.json"),
      consumer: path.join(fixturesDir, "unknown-schema/consumer.json"),
      format: "json",
      strict: true,
    });
    expect(codeStrict).toBe(2);
  });

  it("Scenario 6 (Frontend Tool): returns exit code 0", async () => {
    const code = await runCheck({
      provider: path.join(fixturesDir, "frontend-tool/provider.json"),
      consumer: path.join(fixturesDir, "frontend-tool/consumer.json"),
      format: "json",
    });
    expect(code).toBe(0);
  });
});
