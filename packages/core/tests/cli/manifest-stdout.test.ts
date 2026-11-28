import { execFileSync, spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const pkgRoot = path.resolve(import.meta.dirname, "../..");
const bin = path.join(pkgRoot, "dist/bin/aik.js");
const producer = ["--producer-name", "a", "--producer-version", "1", "--build-id", "b"];

function largeToolsInput(): string {
  const tools = Array.from({ length: 120 }, (_, index) => ({
    name: `tool${index}`,
    executionSide: "backend",
    parameters: {
      type: "object",
      properties: Object.fromEntries(
        Array.from({ length: 40 }, (__, property) => [
          `field${property}`,
          { type: "string", description: "x".repeat(40) },
        ]),
      ),
    },
  }));
  return JSON.stringify({ tools });
}

function collect(stream: NodeJS.ReadableStream): Promise<Buffer> {
  const chunks: Buffer[] = [];
  return new Promise((resolve, reject) => {
    stream.on("data", (chunk: Buffer) => {
      chunks.push(chunk);
    });
    stream.on("end", () => resolve(Buffer.concat(chunks)));
    stream.on("error", reject);
  });
}

describe("aik manifest stdout (built binary)", () => {
  let dir: string;
  let input: string;
  let expected: unknown;
  let expectedSize: number;

  beforeAll(() => {
    execFileSync("pnpm", ["exec", "tsup"], { cwd: pkgRoot, stdio: "pipe" });
    expect(fs.existsSync(bin)).toBe(true);

    dir = fs.mkdtempSync(path.join(os.tmpdir(), "aik-manifest-stdout-"));
    input = path.join(dir, "tools.json");
    fs.writeFileSync(input, largeToolsInput());

    const output = path.join(dir, "expected.json");
    execFileSync(
      process.execPath,
      [bin, "manifest", input, "--from", "tools-json", "-o", output, ...producer],
      {
        stdio: "pipe",
      },
    );
    const raw = fs.readFileSync(output);
    expectedSize = raw.length;
    expected = JSON.parse(raw.toString("utf-8"));
    expect(expectedSize).toBeGreaterThan(65_536);
  }, 60_000);

  afterAll(() => {
    if (dir !== undefined) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it("emits complete valid JSON when stdout is piped to a delayed reader", async () => {
    const reader = spawn(
      process.execPath,
      [
        "--input-type=module",
        "-e",
        "await new Promise((resolve) => setTimeout(resolve, 2000)); const chunks = []; for await (const chunk of process.stdin) chunks.push(chunk); process.stdout.write(Buffer.concat(chunks));",
      ],
      { stdio: ["pipe", "pipe", "pipe"] },
    );

    const child = spawn(
      process.execPath,
      [bin, "manifest", input, "--from", "tools-json", ...producer],
      {
        stdio: ["ignore", "pipe", "pipe"],
      },
    );
    child.stdout?.pipe(reader.stdin);

    const stdout = collect(reader.stdout ?? process.stdin);
    const stderr = collect(child.stderr ?? process.stdin);
    const childCode = new Promise<number | null>((resolve) => child.once("close", resolve));
    const readerCode = new Promise<number | null>((resolve) => reader.once("close", resolve));

    const output = await stdout;
    expect((await stderr).toString("utf-8")).toBe("");
    expect(await readerCode).toBe(0);
    expect(await childCode).toBe(0);
    expect(output.length).toBe(expectedSize);
    expect(JSON.parse(output.toString("utf-8"))).toEqual(expected);
  }, 20_000);
});
