import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { verifyRelease } from "./verify-release.mjs";

const __filename = fileURLToPath(import.meta.url);
const scriptPath = path.resolve(path.dirname(__filename), "verify-release.mjs");

function setupTestRepo(options = {}) {
  const {
    version = "1.0.0-beta.1",
    packageName = "@agent-interaction-kit/core",
    isPrivate = undefined,
    branchName = "main",
  } = options;

  const tmpDir = mkdtempSync(path.join(os.tmpdir(), "verify-release-test-"));
  const git = (...args) => execFileSync("git", args, { cwd: tmpDir, encoding: "utf8" }).trim();

  git("init", "-b", branchName);
  git("config", "user.name", "Release Tester");
  git("config", "user.email", "release@tester.local");
  git("config", "commit.gpgsign", "false");

  mkdirSync(path.join(tmpDir, "packages/core"), { recursive: true });
  const pkgJson = {
    name: packageName,
    version,
  };
  if (isPrivate !== undefined) {
    pkgJson.private = isPrivate;
  }
  writeFileSync(path.join(tmpDir, "packages/core/package.json"), JSON.stringify(pkgJson, null, 2));

  git("add", ".");
  git("commit", "-m", `chore: release ${version}`);
  const commitSha = git("rev-parse", "HEAD");

  // Create tracking ref for origin/main
  git("update-ref", "refs/remotes/origin/main", commitSha);

  return { tmpDir, git, commitSha };
}

test("verifyRelease passes for valid tag on HEAD that is an ancestor of origin/main", () => {
  const { tmpDir, git, commitSha } = setupTestRepo({ version: "1.0.0-beta.1" });
  try {
    git("tag", "v1.0.0-beta.1", commitSha);

    const outputFile = path.join(tmpDir, "github_output.txt");
    const result = verifyRelease({
      tag: "v1.0.0-beta.1",
      cwd: tmpDir,
      env: { GITHUB_OUTPUT: outputFile },
    });

    assert.deepEqual(result, {
      tag: "v1.0.0-beta.1",
      sha: commitSha,
      version: "1.0.0-beta.1",
      channel: "next",
    });

    const outputContent = readFileSync(outputFile, "utf8");
    assert.match(outputContent, /tag=v1\.0\.0-beta\.1/);
    assert.match(outputContent, new RegExp(`sha=${commitSha}`));
    assert.match(outputContent, /version=1\.0\.0-beta\.1/);
    assert.match(outputContent, /channel=next/);

    // Also verify CLI execution
    const cliRun = spawnSync(process.execPath, [scriptPath, "v1.0.0-beta.1"], {
      cwd: tmpDir,
      encoding: "utf8",
    });
    assert.equal(cliRun.status, 0, cliRun.stderr);
    const cliParsed = JSON.parse(cliRun.stdout.trim());
    assert.deepEqual(cliParsed, result);
  } finally {
    rmSync(tmpDir, { recursive: true, force: true });
  }
});

test("verifyRelease passes for stable version routing to latest channel", () => {
  const { tmpDir, git, commitSha } = setupTestRepo({ version: "1.0.0" });
  try {
    git("tag", "v1.0.0", commitSha);

    const result = verifyRelease({
      tag: "v1.0.0",
      cwd: tmpDir,
      env: {},
    });

    assert.deepEqual(result, {
      tag: "v1.0.0",
      sha: commitSha,
      version: "1.0.0",
      channel: "latest",
    });
  } finally {
    rmSync(tmpDir, { recursive: true, force: true });
  }
});

test("verifyRelease fails when tag does not match package.json version", () => {
  const { tmpDir, git, commitSha } = setupTestRepo({ version: "1.0.0-beta.1" });
  try {
    git("tag", "v1.0.0-beta.2", commitSha);

    assert.throws(
      () => {
        verifyRelease({
          tag: "v1.0.0-beta.2",
          cwd: tmpDir,
        });
      },
      {
        message: /Release tag does not match package version/,
      },
    );
  } finally {
    rmSync(tmpDir, { recursive: true, force: true });
  }
});

test("verifyRelease fails when HEAD commit is divergent from tag commit", () => {
  const { tmpDir, git, commitSha: tagSha } = setupTestRepo({ version: "1.0.0-beta.1" });
  try {
    git("tag", "v1.0.0-beta.1", tagSha);

    // Advance HEAD to a new commit
    git("commit", "--allow-empty", "-m", "fix: advance HEAD");
    const headSha = git("rev-parse", "HEAD");
    assert.notEqual(headSha, tagSha);

    assert.throws(
      () => {
        verifyRelease({
          tag: "v1.0.0-beta.1",
          cwd: tmpDir,
        });
      },
      {
        message: /HEAD commit \([0-9a-f]+\) does not match tag commit \([0-9a-f]+\)/,
      },
    );
  } finally {
    rmSync(tmpDir, { recursive: true, force: true });
  }
});

test("verifyRelease fails when tag commit is not an ancestor of origin/main (out-of-tree tag)", () => {
  const { tmpDir, git, commitSha: mainSha } = setupTestRepo({ version: "1.0.0-beta.1" });
  try {
    // Create an orphan branch with unrelated history
    git("checkout", "--orphan", "rogue-branch");
    git("commit", "--allow-empty", "-m", "chore: rogue commit");
    const rogueSha = git("rev-parse", "HEAD");

    git("tag", "v1.0.0-beta.1", rogueSha);

    assert.notEqual(rogueSha, mainSha);

    assert.throws(
      () => {
        verifyRelease({
          tag: "v1.0.0-beta.1",
          cwd: tmpDir,
          baseRef: "origin/main",
        });
      },
      {
        message: /is not an ancestor of origin\/main/,
      },
    );
  } finally {
    rmSync(tmpDir, { recursive: true, force: true });
  }
});

test("verifyRelease fails in non-git directory or when tag is missing/invalid", () => {
  const emptyDir = mkdtempSync(path.join(os.tmpdir(), "verify-release-nongit-"));
  try {
    // Missing tag
    assert.throws(
      () => {
        verifyRelease({ tag: "", cwd: emptyDir });
      },
      {
        message: /Release tag argument is required/,
      },
    );

    // Non-git directory
    assert.throws(
      () => {
        verifyRelease({ tag: "v1.0.0-beta.1", cwd: emptyDir });
      },
      // Throws ENOENT for missing manifest or git error
    );
  } finally {
    rmSync(emptyDir, { recursive: true, force: true });
  }
});

test("verifyRelease fails when package name is not @agent-interaction-kit/core", () => {
  const { tmpDir, git, commitSha } = setupTestRepo({
    version: "1.0.0-beta.1",
    packageName: "@agent-interaction-kit/wrong-name",
  });
  try {
    git("tag", "v1.0.0-beta.1", commitSha);

    assert.throws(
      () => {
        verifyRelease({
          tag: "v1.0.0-beta.1",
          cwd: tmpDir,
        });
      },
      {
        message: /Expected package name @agent-interaction-kit\/core/,
      },
    );
  } finally {
    rmSync(tmpDir, { recursive: true, force: true });
  }
});

test("verifyRelease fails when package is private", () => {
  const { tmpDir, git, commitSha } = setupTestRepo({
    version: "1.0.0-beta.1",
    isPrivate: true,
  });
  try {
    git("tag", "v1.0.0-beta.1", commitSha);

    assert.throws(
      () => {
        verifyRelease({
          tag: "v1.0.0-beta.1",
          cwd: tmpDir,
        });
      },
      {
        message: /Expected package to be public/,
      },
    );
  } finally {
    rmSync(tmpDir, { recursive: true, force: true });
  }
});
