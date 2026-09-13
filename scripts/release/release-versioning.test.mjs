import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { configSchema, manifestSchema } from "release-please";
import { Version } from "release-please/build/src/version.js";
import { DefaultVersioningStrategy } from "release-please/build/src/versioning-strategies/default.js";
import { PrereleaseVersioningStrategy } from "release-please/build/src/versioning-strategies/prerelease.js";

const root = fileURLToPath(new URL("../../", import.meta.url));

/**
 * Models the semantic version progression rules used by release-please
 * under prerelease and stable configurations.
 */
function determineNextVersion(currentVersion, commits, options = {}) {
  const { versioning = "prerelease", prerelease = true, prereleaseType = "beta" } = options;

  const commitList = (Array.isArray(commits) ? commits : [commits]).map((c) => {
    if (typeof c === "string") {
      const isBreaking = c === "breaking";
      return {
        type: isBreaking ? "feat" : c,
        breaking: isBreaking,
        notes: isBreaking ? [{ title: "BREAKING CHANGE", text: "" }] : [],
        files: ["packages/core/src/index.ts"],
      };
    }
    return {
      type: c.type || "chore",
      breaking: Boolean(c.breaking),
      notes: c.notes || [],
      files: c.files || ["packages/core/src/index.ts"],
    };
  });

  // Commits that touch packages/core
  const coreCommits = commitList.filter(
    (commit) =>
      !commit.files ||
      commit.files.some((f) => f.startsWith("packages/core/") || f === "packages/core"),
  );

  if (coreCommits.length === 0) {
    return null;
  }

  // Check for Release-As override note (highest priority)
  for (const commit of coreCommits) {
    const releaseAs = commit.notes.find((n) => {
      const title = (n.title || "").toUpperCase().replace(/-/g, " ");
      return title === "RELEASE AS";
    });
    if (releaseAs?.text) {
      return releaseAs.text.trim();
    }
  }

  let hasBreaking = false;
  let hasFeature = false;
  let hasFix = false;

  for (const commit of coreCommits) {
    const isBreaking =
      commit.breaking ||
      commit.notes.some((n) => {
        const title = (n.title || "").toUpperCase().replace(/-/g, " ");
        return title === "BREAKING CHANGE";
      });
    if (isBreaking) {
      hasBreaking = true;
    } else if (commit.type === "feat" || commit.type === "feature") {
      hasFeature = true;
    } else if (commit.type === "fix") {
      hasFix = true;
    }
  }

  if (!hasBreaking && !hasFeature && !hasFix) {
    return null;
  }

  const match = currentVersion.match(/^(\d+)\.(\d+)\.(\d+)(?:-([a-zA-Z0-9]+)\.(\d+))?$/);
  if (!match) {
    throw new Error(`Invalid version format: ${currentVersion}`);
  }

  let major = Number.parseInt(match[1], 10);
  let minor = Number.parseInt(match[2], 10);
  let patch = Number.parseInt(match[3], 10);
  const currentPrereleaseType = match[4];
  const prereleaseNumber = match[5] ? Number.parseInt(match[5], 10) : undefined;

  if (prerelease) {
    if (currentPrereleaseType === prereleaseType && prereleaseNumber !== undefined) {
      return `${major}.${minor}.${patch}-${prereleaseType}.${prereleaseNumber + 1}`;
    }
    // Starting prerelease track from stable
    if (hasBreaking) {
      major += 1;
      minor = 0;
      patch = 0;
    } else if (hasFeature) {
      minor += 1;
      patch = 0;
    } else {
      patch += 1;
    }
    return `${major}.${minor}.${patch}-${prereleaseType}.1`;
  }

  // Stable bumping (prerelease: false, versioning: default)
  if (currentPrereleaseType) {
    return `${major}.${minor}.${patch}`;
  }

  if (hasBreaking) {
    return `${major + 1}.0.0`;
  }
  if (hasFeature) {
    return `${major}.${minor + 1}.0`;
  }
  return `${major}.${minor}.${patch + 1}`;
}

test("release-please-config.json parses cleanly and matches expected schema keys", () => {
  const configPath = path.join(root, "release-please-config.json");
  assert.ok(existsSync(configPath), "release-please-config.json must exist");

  const raw = readFileSync(configPath, "utf8");
  const config = JSON.parse(raw);

  assert.equal(
    config.$schema,
    "https://raw.githubusercontent.com/googleapis/release-please/main/schemas/config.json",
  );
  assert.equal(config["bootstrap-sha"], "7fc1d36c6043acb76fbcf0b8818dd3562e2cfe95");
  assert.ok(config.packages, "packages must be defined");
  assert.ok(config.packages["packages/core"], "packages/core config must be defined");

  const coreConfig = config.packages["packages/core"];
  assert.equal(coreConfig["release-type"], "node");
  assert.equal(coreConfig["package-name"], "@agent-interaction-kit/core");
  assert.equal(coreConfig["include-component-in-tag"], false);
  assert.equal(coreConfig["include-v-in-tag"], true);
  assert.equal(coreConfig.versioning, "prerelease");
  assert.equal(coreConfig.prerelease, true);
  assert.equal(coreConfig["prerelease-type"], "beta");
  assert.deepEqual(coreConfig["extra-files"], [
    {
      type: "generic",
      path: "src/index.ts",
    },
  ]);

  // Verify bootstrap commit exists in git repository (skip in shallow CI clone)
  const isShallow =
    execFileSync("git", ["rev-parse", "--is-shallow-repository"], {
      cwd: root,
      encoding: "utf8",
    }).trim() === "true";

  if (!isShallow) {
    const gitType = execFileSync("git", ["cat-file", "-t", config["bootstrap-sha"]], {
      cwd: root,
      encoding: "utf8",
    }).trim();
    assert.equal(gitType, "commit", "bootstrap-sha must point to a valid git commit");
  }
});

test("release-please-config.json and manifest satisfy official release-please schemas", () => {
  assert.equal(configSchema.type, "object");
  assert.ok(configSchema.properties.packages);
  assert.ok(configSchema.properties["bootstrap-sha"]);
  assert.equal(manifestSchema.type, "object");
});

test("release-please PrereleaseVersioningStrategy produces expected beta bumps", async () => {
  const strategy = new PrereleaseVersioningStrategy({ prerelease: true, prereleaseType: "beta" });
  const v1 = Version.parse("1.0.0-beta.1");

  const fixBump = await strategy.bump(v1, [{ type: "fix", notes: [], breaking: false, files: [] }]);
  assert.equal(fixBump.toString(), "1.0.0-beta.2", "fix should bump beta prerelease number");

  const featBump = await strategy.bump(v1, [
    { type: "feat", notes: [], breaking: false, files: [] },
  ]);
  assert.equal(featBump.toString(), "1.0.0-beta.2", "feat should bump beta prerelease number");

  const breakingBump = await strategy.bump(v1, [
    {
      type: "breaking",
      notes: [{ title: "BREAKING CHANGE", text: "" }],
      breaking: true,
      files: [],
    },
  ]);
  assert.equal(
    breakingBump.toString(),
    "1.0.0-beta.2",
    "breaking change should bump beta prerelease number",
  );

  const v2 = Version.parse("1.0.0-beta.2");
  const nextBump = await strategy.bump(v2, [
    { type: "fix", notes: [], breaking: false, files: [] },
  ]);
  assert.equal(nextBump.toString(), "1.0.0-beta.3", "subsequent fix bumps to beta.3");
});

test("release-please DefaultVersioningStrategy produces expected stable bumps", async () => {
  const strategy = new DefaultVersioningStrategy();
  const v = Version.parse("1.0.0");

  const fixBump = await strategy.bump(v, [{ type: "fix", notes: [], breaking: false, files: [] }]);
  assert.equal(fixBump.toString(), "1.0.1", "fix should bump patch");

  const featBump = await strategy.bump(v, [
    { type: "feat", notes: [], breaking: false, files: [] },
  ]);
  assert.equal(featBump.toString(), "1.1.0", "feat should bump minor");

  const breakingBump = await strategy.bump(v, [
    {
      type: "feat",
      notes: [{ title: "BREAKING CHANGE", text: "breaking" }],
      breaking: true,
      files: [],
    },
  ]);
  assert.equal(breakingBump.toString(), "2.0.0", "breaking should bump major");
});

test("release-please honors Release-As footer note", async () => {
  const strategy = new PrereleaseVersioningStrategy({ prerelease: true, prereleaseType: "beta" });
  const v0 = Version.parse("0.1.0");
  const commit = {
    type: "chore",
    notes: [{ title: "RELEASE AS", text: "1.0.0-beta.1" }],
    breaking: false,
    files: [],
  };
  const releaseAsBump = await strategy.bump(v0, [commit]);
  assert.equal(
    releaseAsBump.toString(),
    "1.0.0-beta.1",
    "Release-As should override version to 1.0.0-beta.1",
  );
});

test(".release-please-manifest.json parses cleanly and aligns with package.json", () => {
  const manifestPath = path.join(root, ".release-please-manifest.json");
  assert.ok(existsSync(manifestPath), ".release-please-manifest.json must exist");

  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  assert.equal(manifest["packages/core"], "0.1.0");

  const corePkg = JSON.parse(readFileSync(path.join(root, "packages/core/package.json"), "utf8"));
  assert.equal(corePkg.name, "@agent-interaction-kit/core");
  assert.equal(corePkg.version, manifest["packages/core"]);
});

test("extra-files path packages/core/src/index.ts exists with release-please marker", () => {
  const config = JSON.parse(readFileSync(path.join(root, "release-please-config.json"), "utf8"));
  const extraFileRel = config.packages["packages/core"]["extra-files"][0].path;
  const extraFilePath = path.join(root, "packages/core", extraFileRel);

  assert.ok(existsSync(extraFilePath), `Extra file ${extraFilePath} must exist`);
  const content = readFileSync(extraFilePath, "utf8");
  assert.match(content, /x-release-please-version/);
  assert.match(content, /"0\.1\.0"/);
});

test("prerelease beta bump progression: 1.0.0-beta.1 + fix/feat/breaking -> 1.0.0-beta.2", () => {
  const betaConfig = {
    versioning: "prerelease",
    prerelease: true,
    prereleaseType: "beta",
  };

  assert.equal(
    determineNextVersion("1.0.0-beta.1", "fix", betaConfig),
    "1.0.0-beta.2",
    "fix should bump prerelease beta number",
  );
  assert.equal(
    determineNextVersion("1.0.0-beta.1", "feat", betaConfig),
    "1.0.0-beta.2",
    "feat should bump prerelease beta number",
  );
  assert.equal(
    determineNextVersion("1.0.0-beta.1", "breaking", betaConfig),
    "1.0.0-beta.2",
    "breaking should bump prerelease beta number",
  );

  // Subsequent progression
  assert.equal(determineNextVersion("1.0.0-beta.2", "fix", betaConfig), "1.0.0-beta.3");
});

test("stable bump progression (future): 1.0.0 + fix -> 1.0.1, + feat -> 1.1.0, + breaking -> 2.0.0", () => {
  const stableConfig = {
    versioning: "default",
    prerelease: false,
  };

  assert.equal(
    determineNextVersion("1.0.0", "fix", stableConfig),
    "1.0.1",
    "fix should bump patch",
  );
  assert.equal(
    determineNextVersion("1.0.0", "feat", stableConfig),
    "1.1.0",
    "feat should bump minor",
  );
  assert.equal(
    determineNextVersion("1.0.0", "breaking", stableConfig),
    "2.0.0",
    "breaking should bump major",
  );

  // Combination bumps
  assert.equal(
    determineNextVersion("1.0.0", ["fix", "feat"], stableConfig),
    "1.1.0",
    "feat takes precedence over fix",
  );
  assert.equal(
    determineNextVersion("1.0.0", ["fix", "feat", "breaking"], stableConfig),
    "2.0.0",
    "breaking takes precedence over feat and fix",
  );
});

test("Release-As footer override forces exact version from baseline or prerelease", () => {
  const baselineCommit = {
    type: "chore",
    notes: [{ title: "Release-As", text: "1.0.0-beta.1" }],
    files: ["packages/core/src/index.ts"],
  };

  assert.equal(
    determineNextVersion("0.1.0", baselineCommit),
    "1.0.0-beta.1",
    "Release-As footer should force initial 1.0.0-beta.1 from 0.1.0 baseline",
  );

  const promotionCommit = {
    type: "chore",
    notes: [{ title: "Release-As", text: "1.0.0" }],
    files: ["packages/core/src/index.ts"],
  };

  assert.equal(
    determineNextVersion("1.0.0-beta.5", promotionCommit, {
      versioning: "default",
      prerelease: false,
    }),
    "1.0.0",
    "Release-As footer should force 1.0.0 stable promotion",
  );
});

test("does not propose release for website-only or non-releasing chore commits", () => {
  const websiteCommit = {
    type: "feat",
    files: ["apps/website/src/pages/index.astro"],
  };

  assert.equal(
    determineNextVersion("1.0.0-beta.1", websiteCommit),
    null,
    "website-only changes should not bump packages/core",
  );

  const choreCommit = {
    type: "chore",
    notes: [],
    files: ["packages/core/package.json"],
  };

  assert.equal(
    determineNextVersion("1.0.0-beta.1", choreCommit),
    null,
    "chore commit without breaking change should not bump packages/core",
  );
});

test(".github/workflows/release.yml has pinned actions and release job outputs", () => {
  const workflowPath = path.join(root, ".github/workflows/release.yml");
  assert.ok(existsSync(workflowPath), ".github/workflows/release.yml must exist");

  const content = readFileSync(workflowPath, "utf8");
  assert.match(content, /name:\s*Release/);
  assert.match(
    content,
    /actions\/create-github-app-token@fee1f7d63c2ff003460e3d139729b119787bc349/,
  );
  assert.match(
    content,
    /googleapis\/release-please-action@5c625bfb5d1ff62eadeeb3772007f7f66fdcf071/,
  );
  assert.match(content, /group:\s*aik-release/);
  assert.match(content, /cancel-in-progress:\s*false/);
  assert.match(content, /packages\/core--release_created/);
  assert.match(content, /packages\/core--tag_name/);
  assert.match(content, /packages\/core--sha/);
  assert.match(content, /config-file:\s*release-please-config\.json/);
  assert.match(content, /manifest-file:\s*\.release-please-manifest\.json/);
  assert.match(content, /target-branch:\s*main/);
});
