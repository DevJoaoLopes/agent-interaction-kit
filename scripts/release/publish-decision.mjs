import assert from "node:assert/strict";
import crypto from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Parses semantic version string supporting stable and prerelease forms.
 * Example: "1.0.0-beta.1" -> { major: 1, minor: 0, patch: 0, prereleaseType: "beta", prereleaseNum: 1 }
 */
export function parseSemver(version) {
  const match = version.match(/^(\d+)\.(\d+)\.(\d+)(?:-([a-zA-Z0-9]+)\.(\d+))?$/);
  if (!match) {
    throw new Error(`Invalid semver format: ${version}`);
  }
  return {
    major: Number.parseInt(match[1], 10),
    minor: Number.parseInt(match[2], 10),
    patch: Number.parseInt(match[3], 10),
    prereleaseType: match[4] || null,
    prereleaseNum: match[5] !== undefined ? Number.parseInt(match[5], 10) : null,
  };
}

/**
 * Compares two semantic version strings.
 * Returns -1 if v1 < v2, 0 if v1 === v2, 1 if v1 > v2.
 */
export function compareSemver(v1, v2) {
  const p1 = parseSemver(v1);
  const p2 = parseSemver(v2);

  if (p1.major !== p2.major) return p1.major - p2.major > 0 ? 1 : -1;
  if (p1.minor !== p2.minor) return p1.minor - p2.minor > 0 ? 1 : -1;
  if (p1.patch !== p2.patch) return p1.patch - p2.patch > 0 ? 1 : -1;

  // Stable releases are strictly greater than prereleases of the same major.minor.patch
  if (p1.prereleaseType && !p2.prereleaseType) return -1;
  if (!p1.prereleaseType && p2.prereleaseType) return 1;

  if (p1.prereleaseType && p2.prereleaseType) {
    if (p1.prereleaseType !== p2.prereleaseType) {
      return p1.prereleaseType.localeCompare(p2.prereleaseType);
    }
    const n1 = p1.prereleaseNum ?? 0;
    const n2 = p2.prereleaseNum ?? 0;
    if (n1 !== n2) return n1 - n2 > 0 ? 1 : -1;
  }

  return 0;
}

/**
 * Computes SRI SHA-512 hash in the format expected by npm dist.integrity (`sha512-<base64>`).
 */
export function computeSriHash(filePathOrBuffer) {
  const buffer =
    typeof filePathOrBuffer === "string" ? readFileSync(filePathOrBuffer) : filePathOrBuffer;
  const hash = crypto.createHash("sha512").update(buffer).digest("base64");
  return `sha512-${hash}`;
}

/**
 * Parses output from `npm view <spec> --json`.
 * Explicitly distinguishes 404 (absent) from network, timeout, or auth errors.
 */
export function parseNpmViewOutput({ status, stdout = "", stderr = "" }) {
  if (status === 0) {
    try {
      return { found: true, data: JSON.parse(stdout) };
    } catch (err) {
      throw new Error(`Failed to parse npm view output as JSON: ${err.message}`);
    }
  }

  const combined = `${stdout}\n${stderr}`;
  const is404 =
    combined.includes("E404") ||
    combined.includes("404 Not Found") ||
    /npm error code E404/.test(combined);

  if (is404) {
    return { found: false, notFound: true };
  }

  const isAuthError =
    combined.includes("E403") ||
    combined.includes("E401") ||
    combined.includes("403 Forbidden") ||
    combined.includes("401 Unauthorized");

  const isTimeout =
    combined.includes("ETIMEDOUT") ||
    combined.includes("ECONNREFUSED") ||
    combined.includes("fetch failed");

  let errorCategory = "Registry query failed";
  if (isAuthError) errorCategory = "Registry auth error (401/403)";
  else if (isTimeout) errorCategory = "Registry timeout/network error";

  const error = new Error(
    `${errorCategory}: npm view exited with code ${status}: ${stderr.trim() || stdout.trim()}`,
  );
  error.status = status;
  error.code = isAuthError ? "AUTH_ERROR" : isTimeout ? "TIMEOUT" : "REGISTRY_ERROR";
  throw error;
}

/**
 * Evaluates the publication decision based on package metadata and registry state.
 *
 * Scenarios:
 * 1. Bootstrap pending: NPM_PUBLISH_ENABLED !== 'true'
 * 2. Absent from registry: Publish with OIDC and specified channel tag
 * 3. Existing with matching integrity: Verify without republishing
 * 4. Existing with divergent integrity: Throw / fail (tampering / divergent build)
 * 5. Retry of older version: Verify without updating dist-tags or triggering deploy
 */
export function evaluatePublishDecision({
  npmPublishEnabled = false,
  packageName = "@agent-interaction-kit/core",
  version,
  channel,
  tarballPath = "",
  tarballIntegrity,
  registryState,
  distTags = {},
}) {
  assert.ok(version, "version is required");
  assert.ok(channel, "channel is required");
  assert.ok(tarballIntegrity, "tarballIntegrity is required");

  const isPublishEnabled = npmPublishEnabled === true || npmPublishEnabled === "true";

  if (!isPublishEnabled) {
    return {
      action: "bootstrap-pending",
      reason:
        "Bootstrap mode active: NPM_PUBLISH_ENABLED is not 'true'. Tarball generated and validated; awaiting manual maintainer bootstrap publish.",
      packageName,
      version,
      channel,
      tarballIntegrity,
    };
  }

  if (!registryState.found) {
    return {
      action: "publish",
      packageName,
      version,
      channel,
      tarballPath,
      tarballIntegrity,
      command: `npm publish "${tarballPath}" --access public --tag "${channel}"`,
      reason: `Version ${version} is absent from registry (404). Proceeding to publish with tag "${channel}".`,
    };
  }

  // Version exists in registry
  const registryIntegrity = registryState.data?.dist?.integrity;
  if (!registryIntegrity) {
    throw new Error(`Registry metadata for ${packageName}@${version} is missing dist.integrity`);
  }

  if (registryIntegrity !== tarballIntegrity) {
    throw new Error(
      `Integrity mismatch for ${packageName}@${version}: registry integrity (${registryIntegrity}) does not match local tarball integrity (${tarballIntegrity}). Potential tampering or non-reproducible build.`,
    );
  }

  // Integrity matches. Check if this is a retry of an older version.
  const currentChannelHead = distTags[channel];
  let isOlderVersion = false;
  if (currentChannelHead) {
    isOlderVersion = compareSemver(version, currentChannelHead) < 0;
  }

  return {
    action: "verify",
    isRetry: true,
    isOlderVersion,
    shouldRetag: false,
    currentChannelHead: currentChannelHead || version,
    packageName,
    version,
    channel,
    tarballIntegrity,
    reason: isOlderVersion
      ? `Version ${version} already exists with matching integrity, but is older than current ${channel} head (${currentChannelHead}). Verified without retagging or deploy.`
      : `Version ${version} already exists in registry with matching integrity. Verified without republishing.`,
  };
}

const isCli =
  Boolean(process.argv[1]) && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isCli) {
  const [subcommand, ...args] = process.argv.slice(2);
  if (subcommand === "compare-semver") {
    const [v1, v2] = args;
    console.log(compareSemver(v1, v2));
  } else if (subcommand === "sri-hash") {
    const [target] = args;
    console.log(computeSriHash(target));
  } else {
    console.error(`Unknown subcommand: ${subcommand}`);
    process.exit(1);
  }
}
