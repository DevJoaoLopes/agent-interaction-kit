import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { appendFileSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { validateTag } from "./policy.mjs";

export function verifyRelease(options = {}) {
  const tag = options.tag ?? process.argv[2];
  if (!tag) {
    throw new Error("Release tag argument is required");
  }

  const cwd = options.cwd ?? process.cwd();
  const manifestPath = options.manifestPath ?? path.resolve(cwd, "packages/core/package.json");
  const baseRef = options.baseRef ?? "origin/main";
  const env = options.env ?? process.env;

  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  const channel = validateTag(tag, manifest.version);

  assert.equal(
    manifest.name,
    "@agent-interaction-kit/core",
    `Expected package name @agent-interaction-kit/core, got ${manifest.name}`,
  );
  assert.equal(
    manifest.private,
    undefined,
    `Expected package to be public (manifest.private undefined), got ${manifest.private}`,
  );

  const git =
    options.gitExec ?? ((...args) => execFileSync("git", args, { cwd, encoding: "utf8" }).trim());

  const sha = git("rev-parse", `refs/tags/${tag}^{commit}`);
  const headSha = git("rev-parse", "HEAD");
  assert.equal(headSha, sha, `HEAD commit (${headSha}) does not match tag commit (${sha})`);

  try {
    git("merge-base", "--is-ancestor", sha, baseRef);
  } catch (err) {
    throw new Error(`Tag commit ${sha} is not an ancestor of ${baseRef}: ${err.message}`, {
      cause: err,
    });
  }

  const result = { tag, sha, version: manifest.version, channel };

  if (env.GITHUB_OUTPUT) {
    for (const [key, value] of Object.entries(result)) {
      appendFileSync(env.GITHUB_OUTPUT, `${key}=${value}\n`);
    }
  }

  return result;
}

const isCli =
  Boolean(process.argv[1]) && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isCli) {
  const result = verifyRelease();
  console.log(JSON.stringify(result));
}
