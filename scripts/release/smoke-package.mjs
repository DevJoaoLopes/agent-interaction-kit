import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { channelFor } from "./policy.mjs";

const root = fileURLToPath(new URL("../../", import.meta.url));
const fixtures = path.join(root, "packages/core/fixtures");
export function createPackageConsumer({ source, version, execFn = spawnSync }) {
  channelFor(version);
  const packageSource = existsSync(source) ? path.resolve(source) : source;
  assert.ok(
    (path.isAbsolute(packageSource) &&
      packageSource.endsWith(".tgz") &&
      existsSync(packageSource)) ||
      packageSource === `@agent-interaction-kit/core@${version}`,
    "Package source must be a local tarball or the exact scoped npm version",
  );
  const cwd = mkdtempSync(path.join(os.tmpdir(), "aik-consumer-"));
  const cleanup = () => rmSync(cwd, { recursive: true, force: true });
  const run = (cmd, args) =>
    execFn(cmd, args, {
      cwd,
      encoding: "utf8",
      timeout: 120000,
      shell: false,
      env: { ...process.env, NODE_PATH: "", NO_COLOR: "1", FORCE_COLOR: "0" },
    });
  try {
    writeFileSync(
      path.join(cwd, "package.json"),
      JSON.stringify({
        name: "aik-release-smoke",
        private: true,
        type: "module",
        scripts: { "test:contracts": "aik check" },
      }),
    );
    const install = run("npm", [
      "install",
      "--ignore-scripts",
      "--no-audit",
      "--no-fund",
      "--save-dev",
      "--save-exact",
      packageSource,
    ]);
    assert.equal(install.status, 0, install.stderr);
    const installed = JSON.parse(
      readFileSync(path.join(cwd, "node_modules/@agent-interaction-kit/core/package.json"), "utf8"),
    );
    assert.equal(installed.name, "@agent-interaction-kit/core", "Installed package name mismatch");
    assert.equal(installed.version, version, "Installed version does not match candidate version");
    const bin = path.resolve(cwd, "node_modules/@agent-interaction-kit/core", installed.bin.aik);
    const cli = (args) => run(process.execPath, [bin, ...args]);
    const reportedVersion = cli(["--version"]);
    assert.equal(reportedVersion.status, 0, reportedVersion.stderr);
    assert.equal(reportedVersion.stdout.trim(), version, "CLI version mismatch");
    return { cwd, run, cli, cleanup };
  } catch (error) {
    cleanup();
    throw error;
  }
}

export function smokePackage(source, expectedVersion) {
  const { cwd, run, cleanup } = createPackageConsumer({ source, version: expectedVersion });
  try {
    const imports = run(process.execPath, [
      "--input-type=module",
      "-e",
      `
    for (const suffix of ["", "/contracts", "/core", "/reporters"]) {
      await import("@agent-interaction-kit/core" + suffix);
    }
  `,
    ]);
    assert.equal(imports.status, 0, imports.stderr);
    const cases = [
      ["valid", true, 0, "pass"],
      ["breaking-result", true, 1, "fail"],
      ["breaking-args", true, 1, "fail"],
      ["missing-tool", true, 1, "fail"],
      ["unknown-schema", false, 0, "unknown"],
      ["unknown-schema", true, 2, "unknown"],
      ["frontend-tool", true, 0, "pass"],
    ];
    for (const [name, strict, code, status] of cases) {
      const result = run("npm", [
        "run",
        "--silent",
        "test:contracts",
        "--",
        "--provider",
        path.join(fixtures, name, "provider.json"),
        "--consumer",
        path.join(fixtures, name, "consumer.json"),
        "--format",
        "json",
        ...(strict ? ["--strict"] : []),
      ]);
      assert.equal(result.status, code, `${name}: ${result.stderr}`);
      assert.equal(JSON.parse(result.stdout).status, status);
    }
    writeFileSync(path.join(cwd, "invalid.json"), "{}");
    const invalid = run("npm", [
      "run",
      "--silent",
      "test:contracts",
      "--",
      "--provider",
      "invalid.json",
      "--consumer",
      "invalid.json",
      "--strict",
    ]);
    assert.equal(invalid.status, 2, invalid.stderr);
    return {
      source,
      version: expectedVersion,
      cli: "passed",
      imports: "passed",
      scenarios: 8,
    };
  } finally {
    cleanup();
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [source, expectedVersion] = process.argv.slice(2);
  assert.ok(
    source && expectedVersion,
    "Usage: smoke-package.mjs <tarball|exact npm spec> <version>",
  );
  console.log(JSON.stringify(smokePackage(source, expectedVersion)));
}
