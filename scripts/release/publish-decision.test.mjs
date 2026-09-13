import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
  compareSemver,
  computeSriHash,
  evaluatePublishDecision,
  parseNpmViewOutput,
  parseSemver,
} from "./publish-decision.mjs";

const __filename = fileURLToPath(import.meta.url);
const scriptPath = path.resolve(path.dirname(__filename), "publish-decision.mjs");

test("compareSemver correctly compares versions across stable and prerelease channels", () => {
  // Prerelease progression
  assert.equal(compareSemver("1.0.0-beta.1", "1.0.0-beta.2"), -1);
  assert.equal(compareSemver("1.0.0-beta.2", "1.0.0-beta.1"), 1);
  assert.equal(compareSemver("1.0.0-beta.1", "1.0.0-beta.1"), 0);

  // Stable vs prerelease
  assert.equal(compareSemver("1.0.0-beta.5", "1.0.0"), -1);
  assert.equal(compareSemver("1.0.0", "1.0.0-beta.5"), 1);

  // Stable progression
  assert.equal(compareSemver("1.0.0", "1.0.1"), -1);
  assert.equal(compareSemver("1.0.1", "1.1.0"), -1);
  assert.equal(compareSemver("1.1.0", "2.0.0"), -1);
  assert.equal(compareSemver("2.0.0", "1.9.9"), 1);

  // Invalid formats
  assert.throws(() => parseSemver("not-a-semver"), {
    message: /Invalid semver format/,
  });
});

test("computeSriHash computes valid sha512 integrity string", () => {
  const tmpDir = mkdtempSync(path.join(os.tmpdir(), "sri-test-"));
  try {
    const testFile = path.join(tmpDir, "sample.tar.gz");
    writeFileSync(testFile, "test content for sha512 integrity verification");

    const sri = computeSriHash(testFile);
    assert.match(sri, /^sha512-[A-Za-z0-9+/=]+$/);

    // CLI invocation
    const cliRun = spawnSync(process.execPath, [scriptPath, "sri-hash", testFile], {
      encoding: "utf8",
    });
    assert.equal(cliRun.status, 0);
    assert.equal(cliRun.stdout.trim(), sri);
  } finally {
    rmSync(tmpDir, { recursive: true, force: true });
  }
});

test("parseNpmViewOutput cleanly differentiates 404 (absent) from errors and successes", () => {
  // 1. Success case
  const mockPkg = {
    name: "@agent-interaction-kit/core",
    version: "1.0.0-beta.1",
    dist: { integrity: "sha512-validIntegrity==" },
  };
  const successOutput = parseNpmViewOutput({
    status: 0,
    stdout: JSON.stringify(mockPkg),
  });
  assert.equal(successOutput.found, true);
  assert.deepEqual(successOutput.data, mockPkg);

  // 2. 404 absent case (standard npm error)
  const notFoundOutput = parseNpmViewOutput({
    status: 1,
    stdout: "",
    stderr:
      "npm error code E404\nnpm error 404 Not Found - GET https://registry.npmjs.org/@agent-interaction-kit%2fcore",
  });
  assert.equal(notFoundOutput.found, false);
  assert.equal(notFoundOutput.notFound, true);

  // 3. Auth error (403 Forbidden)
  assert.throws(
    () => {
      parseNpmViewOutput({
        status: 1,
        stdout: "",
        stderr:
          "npm error code E403\nnpm error 403 Forbidden - PUT https://registry.npmjs.org/@agent-interaction-kit%2fcore",
      });
    },
    (err) => {
      assert.equal(err.code, "AUTH_ERROR");
      assert.match(err.message, /Registry auth error \(401\/403\)/);
      return true;
    },
  );

  // 4. Timeout / Network error
  assert.throws(
    () => {
      parseNpmViewOutput({
        status: 1,
        stdout: "",
        stderr:
          "npm error code ETIMEDOUT\nnpm error request to https://registry.npmjs.org failed, reason: connect ETIMEDOUT",
      });
    },
    (err) => {
      assert.equal(err.code, "TIMEOUT");
      assert.match(err.message, /Registry timeout\/network error/);
      return true;
    },
  );
});

test("evaluatePublishDecision: Bootstrap pending when NPM_PUBLISH_ENABLED is not 'true'", () => {
  const decision = evaluatePublishDecision({
    npmPublishEnabled: "false",
    packageName: "@agent-interaction-kit/core",
    version: "1.0.0-beta.1",
    channel: "next",
    tarballPath: "packages/core/dist.tgz",
    tarballIntegrity: "sha512-localTestHash==",
    registryState: { found: false },
  });

  assert.equal(decision.action, "bootstrap-pending");
  assert.match(decision.reason, /Bootstrap mode active/);
  assert.equal(decision.version, "1.0.0-beta.1");
});

test("evaluatePublishDecision: Absent version routes to publish branch with OIDC command", () => {
  const decision = evaluatePublishDecision({
    npmPublishEnabled: true,
    packageName: "@agent-interaction-kit/core",
    version: "1.0.0-beta.1",
    channel: "next",
    tarballPath: "dist-package/agent-interaction-kit-core-1.0.0-beta.1.tgz",
    tarballIntegrity: "sha512-expectedTarballHash==",
    registryState: { found: false },
  });

  assert.equal(decision.action, "publish");
  assert.equal(decision.channel, "next");
  assert.equal(decision.version, "1.0.0-beta.1");
  assert.equal(
    decision.command,
    'npm publish "dist-package/agent-interaction-kit-core-1.0.0-beta.1.tgz" --access public --tag "next"',
  );
});

test("evaluatePublishDecision: Existing version with matching integrity routes to verify branch without republishing", () => {
  const localIntegrity = "sha512-matchingIntegrityHash==";
  const decision = evaluatePublishDecision({
    npmPublishEnabled: true,
    packageName: "@agent-interaction-kit/core",
    version: "1.0.0-beta.1",
    channel: "next",
    tarballPath: "dist-package/agent-interaction-kit-core-1.0.0-beta.1.tgz",
    tarballIntegrity: localIntegrity,
    registryState: {
      found: true,
      data: {
        name: "@agent-interaction-kit/core",
        version: "1.0.0-beta.1",
        dist: { integrity: localIntegrity },
      },
    },
    distTags: { next: "1.0.0-beta.1" },
  });

  assert.equal(decision.action, "verify");
  assert.equal(decision.isRetry, true);
  assert.equal(decision.isOlderVersion, false);
  assert.equal(decision.shouldRetag, false);
  assert.match(decision.reason, /Verified without republishing/);
});

test("evaluatePublishDecision: Existing version with divergent integrity throws error (tampering/divergent build)", () => {
  assert.throws(
    () => {
      evaluatePublishDecision({
        npmPublishEnabled: true,
        packageName: "@agent-interaction-kit/core",
        version: "1.0.0-beta.1",
        channel: "next",
        tarballPath: "dist-package/agent-interaction-kit-core-1.0.0-beta.1.tgz",
        tarballIntegrity: "sha512-localBuildIntegrity==",
        registryState: {
          found: true,
          data: {
            name: "@agent-interaction-kit/core",
            version: "1.0.0-beta.1",
            dist: { integrity: "sha512-divergentRegistryIntegrity==" },
          },
        },
      });
    },
    {
      message:
        /Integrity mismatch for @agent-interaction-kit\/core@1\.0\.0-beta\.1: registry integrity .* does not match local tarball integrity/,
    },
  );
});

test("evaluatePublishDecision: Retry with older version verifies without retagging or redeploying", () => {
  const localIntegrity = "sha512-matchingOlderIntegrity==";
  const decision = evaluatePublishDecision({
    npmPublishEnabled: true,
    packageName: "@agent-interaction-kit/core",
    version: "1.0.0-beta.1",
    channel: "next",
    tarballPath: "dist-package/agent-interaction-kit-core-1.0.0-beta.1.tgz",
    tarballIntegrity: localIntegrity,
    registryState: {
      found: true,
      data: {
        name: "@agent-interaction-kit/core",
        version: "1.0.0-beta.1",
        dist: { integrity: localIntegrity },
      },
    },
    distTags: {
      next: "1.0.0-beta.2", // Registry already advanced to beta.2
      latest: "1.0.0",
    },
  });

  assert.equal(decision.action, "verify");
  assert.equal(decision.isRetry, true);
  assert.equal(decision.isOlderVersion, true);
  assert.equal(decision.shouldRetag, false);
  assert.equal(decision.currentChannelHead, "1.0.0-beta.2");
  assert.match(decision.reason, /older than current next head \(1\.0\.0-beta\.2\)/);
});
