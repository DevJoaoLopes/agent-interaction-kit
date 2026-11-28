import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { runCheck } from "../../src/cli/commands/check.js";
import { runManifest } from "../../src/cli/commands/manifest.js";

const mafDir = path.resolve("../../examples/maf-dotnet/fixtures");
const producer = {
  producerName: "maf-dotnet-agent",
  producerVersion: "1.0.0",
  buildId: "fixture",
};

describe("MAF .NET tools export (examples/maf-dotnet)", () => {
  let dir: string;

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), "aik-maf-"));
    vi.spyOn(console, "log").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
    fs.rmSync(dir, { recursive: true, force: true });
  });

  async function generate(): Promise<string> {
    const provider = path.join(dir, "aik.provider.json");
    const code = await runManifest({
      from: "tools-json",
      input: path.join(mafDir, "tools.json"),
      output: provider,
      ...producer,
    });
    expect(code).toBe(0);
    return provider;
  }

  it("turns the exported tools into a manifest that keeps the real schemas", async () => {
    const manifest = JSON.parse(fs.readFileSync(await generate(), "utf-8"));

    const byName = Object.fromEntries(
      manifest.tools.map((tool: { name: string }) => [tool.name, tool]),
    );
    expect(Object.keys(byName)).toEqual(["getWeather", "trackEvent", "confirmBooking"]);
    expect(byName.getWeather.executionSide).toBe("backend");
    expect(byName.confirmBooking.executionSide).toBe("frontend");
    expect(byName.getWeather.parameters.properties.unit.enum).toEqual(["Celsius", "Fahrenheit"]);
    expect(byName.getWeather.parameters.properties.days.type).toEqual(["integer", "null"]);
    expect(byName.getWeather.returns.schema.properties.note.type).toEqual(["string", "null"]);
  });

  it("passes aik check --strict against a consumer that matches", async () => {
    const code = await runCheck({
      provider: await generate(),
      consumer: path.join(mafDir, "consumer.json"),
      format: "json",
      output: path.join(dir, "report.json"),
      strict: true,
    });

    expect(code).toBe(0);
  });

  it("fails aik check when the consumer expects another type than the exported schema", async () => {
    const consumer = JSON.parse(fs.readFileSync(path.join(mafDir, "consumer.json"), "utf-8"));
    consumer.requires[0].expectedParameters.properties.city = { type: "integer" };
    const consumerPath = path.join(dir, "consumer-breaking.json");
    fs.writeFileSync(consumerPath, JSON.stringify(consumer));

    const code = await runCheck({
      provider: await generate(),
      consumer: consumerPath,
      format: "json",
      output: path.join(dir, "report.json"),
      strict: true,
    });

    expect(code).toBe(1);
  });
});
