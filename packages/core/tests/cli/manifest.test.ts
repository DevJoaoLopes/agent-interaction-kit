import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { runCheck } from "../../src/cli/commands/check.js";
import { runManifest } from "../../src/cli/commands/manifest.js";
import { createCli } from "../../src/cli/index.js";
import { parseProviderManifest } from "../../src/contracts/parser.js";

const fixturesDir = path.resolve("./fixtures/manifest");
const producerFlags = {
  producerName: "booking-agent",
  producerVersion: "3.1.0",
  buildId: "git-f00d",
};

function readJson(file: string): unknown {
  return JSON.parse(fs.readFileSync(file, "utf-8"));
}

describe("runManifest", () => {
  let dir: string;
  let errors: string[];

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), "aik-manifest-"));
    errors = [];
    vi.spyOn(console, "error").mockImplementation((message: unknown) => {
      errors.push(String(message));
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    fs.rmSync(dir, { recursive: true, force: true });
  });

  function writeInput(content: unknown): string {
    const file = path.join(dir, "in.json");
    fs.writeFileSync(file, typeof content === "string" ? content : JSON.stringify(content));
    return file;
  }

  it("generates a provider manifest from a tools-json file", async () => {
    const output = path.join(dir, "out", "aik.provider.json");

    const code = await runManifest({
      from: "tools-json",
      input: path.join(fixturesDir, "tools.json"),
      output,
    });

    expect(code).toBe(0);
    expect(readJson(output)).toEqual({
      schemaVersion: "1.0.0",
      producer: { name: "weather-agent", version: "1.2.0", buildId: "git-a1b2c3" },
      protocolProfile: "ag-ui@0.1",
      contextProfile: "default",
      tools: [
        {
          name: "getWeather",
          description: "Current weather for a city",
          executionSide: "backend",
          parameters: {
            type: "object",
            properties: { city: { type: "string" } },
            required: ["city"],
          },
          returns: {
            format: "json",
            schema: {
              type: "object",
              properties: { temperature: { type: "number" } },
              required: ["temperature"],
            },
          },
        },
        {
          name: "confirmBooking",
          executionSide: "frontend",
          requiresApproval: true,
          parameters: { type: "object", properties: { bookingId: { type: "string" } } },
          returns: { format: "json" },
        },
      ],
    });
    expect(parseProviderManifest(fs.readFileSync(output, "utf-8")).ok).toBe(true);
    expect(fs.readFileSync(output, "utf-8").endsWith("}\n")).toBe(true);
  });

  it("accepts a bare array of tools with flags and applies --execution-side to tools without one", async () => {
    const output = path.join(dir, "provider.json");
    const input = writeInput([
      { name: "ping", parameters: { type: "object" } },
      { name: "pong", executionSide: "frontend", parameters: { type: "object" } },
    ]);

    const code = await runManifest({
      from: "tools-json",
      input,
      output,
      side: "provider",
      executionSide: "backend",
      protocolProfile: "ag-ui@0.2",
      contextProfile: "tenant-a",
      ...producerFlags,
    });

    expect(code).toBe(0);
    expect(readJson(output)).toMatchObject({
      producer: { name: "booking-agent", version: "3.1.0", buildId: "git-f00d" },
      protocolProfile: "ag-ui@0.2",
      contextProfile: "tenant-a",
      tools: [
        { name: "ping", executionSide: "backend" },
        { name: "pong", executionSide: "frontend" },
      ],
    });
  });

  it("lets flags override the metadata in the file", async () => {
    const output = path.join(dir, "provider.json");

    const code = await runManifest({
      from: "tools-json",
      input: path.join(fixturesDir, "tools.json"),
      output,
      producerVersion: "9.9.9",
      contextProfile: "other",
    });

    expect(code).toBe(0);
    expect(readJson(output)).toMatchObject({
      producer: { name: "weather-agent", version: "9.9.9", buildId: "git-a1b2c3" },
      contextProfile: "other",
    });
  });

  it("generates frontend tools from an AG-UI RunAgentInput", async () => {
    const output = path.join(dir, "provider.json");

    const code = await runManifest({
      from: "ag-ui",
      input: path.join(fixturesDir, "ag-ui-input.json"),
      output,
      ...producerFlags,
    });

    expect(code).toBe(0);
    expect(readJson(output)).toEqual({
      schemaVersion: "1.0.0",
      producer: { name: "booking-agent", version: "3.1.0", buildId: "git-f00d" },
      protocolProfile: "ag-ui@0.1",
      contextProfile: "default",
      tools: [
        {
          name: "confirmBooking",
          description: "Ask the user to confirm a booking",
          executionSide: "frontend",
          parameters: {
            type: "object",
            properties: { bookingId: { type: "string" } },
            required: ["bookingId"],
          },
          returns: { format: "json" },
        },
        {
          name: "refreshView",
          description: "Re-render the current view",
          executionSide: "frontend",
          parameters: { type: "object", properties: {} },
          returns: { format: "json" },
        },
      ],
    });
  });

  it("accepts a bare AG-UI Tool[] and --execution-side", async () => {
    const output = path.join(dir, "provider.json");
    const input = writeInput([{ name: "lookup", description: "d", parameters: {} }]);

    const code = await runManifest({
      from: "ag-ui",
      input,
      output,
      executionSide: "backend",
      ...producerFlags,
    });

    expect(code).toBe(0);
    expect(readJson(output)).toMatchObject({
      tools: [{ name: "lookup", executionSide: "backend" }],
    });
  });

  it("writes the manifest to stdout without --output", async () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => {});

    const code = await runManifest({
      from: "tools-json",
      input: path.join(fixturesDir, "tools.json"),
    });

    expect(code).toBe(0);
    expect(log).toHaveBeenCalledTimes(1);
    const printed = String(log.mock.calls[0]?.[0]);
    expect(parseProviderManifest(printed).ok).toBe(true);
  });

  it("produces a manifest that aik check accepts against a consumer", async () => {
    const output = path.join(dir, "provider.json");

    const generated = await runManifest({
      from: "ag-ui",
      input: path.join(fixturesDir, "ag-ui-input.json"),
      output,
      ...producerFlags,
    });
    const code = await runCheck({
      provider: output,
      consumer: path.join(fixturesDir, "consumer.json"),
      format: "json",
      output: path.join(dir, "report.json"),
      strict: true,
    });

    expect(generated).toBe(0);
    expect(code).toBe(0);
  });

  describe("input errors (exit code 2, no file written)", () => {
    async function expectFailure(
      options: Parameters<typeof runManifest>[0],
      message: RegExp,
    ): Promise<void> {
      const output = path.join(dir, "never.json");
      const code = await runManifest({ ...options, output });
      expect(code).toBe(2);
      expect(errors.join("\n")).toMatch(message);
      expect(fs.existsSync(output)).toBe(false);
    }

    it("reports a missing input file", async () => {
      await expectFailure(
        { from: "tools-json", input: path.join(dir, "missing.json") },
        /\[AIK-ERROR\].*not found.*missing\.json/,
      );
    });

    it("reports invalid JSON", async () => {
      await expectFailure(
        {
          from: "tools-json",
          input: writeInput("{ nope"),
          ...producerFlags,
          executionSide: "backend",
        },
        /\[AIK-ERROR\].*not valid JSON/,
      );
    });

    it("rejects an unknown --from format", async () => {
      await expectFailure(
        { from: "openapi", input: writeInput([]), ...producerFlags },
        /Unsupported --from "openapi".*tools-json, ag-ui/,
      );
    });

    it("rejects a --side other than provider", async () => {
      await expectFailure(
        { from: "tools-json", input: writeInput([]), side: "consumer", ...producerFlags },
        /Unsupported --side "consumer".*provider/,
      );
    });

    it("rejects an invalid --execution-side", async () => {
      await expectFailure(
        { from: "tools-json", input: writeInput([]), executionSide: "both", ...producerFlags },
        /Unsupported --execution-side "both".*backend, frontend/,
      );
    });

    it("requires the producer metadata", async () => {
      await expectFailure(
        { from: "ag-ui", input: path.join(fixturesDir, "ag-ui-input.json") },
        /producer.*--producer-name.*--producer-version.*--build-id/,
      );
    });

    it("requires an execution side for every tools-json tool", async () => {
      await expectFailure(
        {
          from: "tools-json",
          input: writeInput([{ name: "ping", parameters: { type: "object" } }]),
          ...producerFlags,
        },
        /tool "ping".*executionSide.*--execution-side/,
      );
    });

    it("rejects an input that is neither a tool array nor an object with tools", async () => {
      await expectFailure(
        { from: "ag-ui", input: writeInput({ threadId: "t" }), ...producerFlags },
        /expected an array of tools or an object with a "tools" array/,
      );
    });

    it("rejects a tool without a name", async () => {
      await expectFailure(
        {
          from: "tools-json",
          input: writeInput([{ parameters: { type: "object" } }]),
          executionSide: "backend",
          ...producerFlags,
        },
        /tools\[0\].*"name"/,
      );
    });

    it("rejects parameters that are not an object schema", async () => {
      await expectFailure(
        {
          from: "tools-json",
          input: writeInput([{ name: "ping", parameters: { type: "string" } }]),
          executionSide: "backend",
          ...producerFlags,
        },
        /parameters\.type must be "object"/,
      );
    });

    it("rejects duplicate tool names through the manifest parser", async () => {
      await expectFailure(
        {
          from: "ag-ui",
          input: writeInput([
            { name: "dup", parameters: {} },
            { name: "dup", parameters: {} },
          ]),
          ...producerFlags,
        },
        /Duplicate tool name "dup"/,
      );
    });
  });
});

describe("aik manifest command", () => {
  it("is registered with its options", () => {
    const manifest = createCli().commands.find((command) => command.name() === "manifest");

    expect(manifest).toBeDefined();
    const flags = manifest?.options.map((option) => option.long);
    expect(flags).toEqual(
      expect.arrayContaining([
        "--from",
        "--side",
        "--execution-side",
        "--producer-name",
        "--producer-version",
        "--build-id",
        "--protocol-profile",
        "--context-profile",
        "--output",
      ]),
    );
  });
});
