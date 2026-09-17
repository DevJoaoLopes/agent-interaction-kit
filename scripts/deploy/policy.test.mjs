import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
  classifyChange,
  evaluateDeployPromotion,
  isGitAncestor,
  isValidSemver,
  isVerifiedPublication,
  selectPublication,
} from "./policy.mjs";

const cliScriptPath = fileURLToPath(new URL("./policy.mjs", import.meta.url));

test("classifyChange: allowlist identification and boundary enforcement", () => {
  // Empty or invalid inputs
  assert.deepEqual(classifyChange([]), {
    websiteOnly: false,
    reason: "No changed files provided",
  });
  assert.deepEqual(classifyChange(null), {
    websiteOnly: false,
    reason: "No changed files provided",
  });
  assert.deepEqual(classifyChange(["", "  ", "\t"]), {
    websiteOnly: false,
    reason: "No changed files provided",
  });

  // Website-only changes in apps/website and docs/deployment
  const websiteOnlyChanges = [
    "apps/website/src/pages/index.astro",
    "apps/website/src/components/Button.tsx",
    "docs/deployment/website-validation.md",
  ];
  assert.deepEqual(classifyChange(websiteOnlyChanges), {
    websiteOnly: true,
    reason: "All changes within website allowlist",
  });

  // Disallowed changes in packages/core
  const coreChange = ["packages/core/src/index.ts"];
  assert.equal(classifyChange(coreChange).websiteOnly, false);
  assert.match(
    classifyChange(coreChange).reason,
    /Disallowed file outside website scope: packages\/core\/src\/index\.ts/,
  );

  // Disallowed changes in root or workflow files
  const rootChanges = ["apps/website/package.json", ".github/workflows/ci.yml"];
  assert.equal(classifyChange(rootChanges).websiteOnly, false);

  // Conservative pnpm-lock.yaml handling without importer analysis
  const lockfileWithoutAnalysis = ["apps/website/src/pages/docs.astro", "pnpm-lock.yaml"];
  assert.deepEqual(classifyChange(lockfileWithoutAnalysis), {
    websiteOnly: false,
    reason: "Lockfile changes require importer impact analysis to qualify as website-only",
  });
  assert.deepEqual(classifyChange(lockfileWithoutAnalysis, { lockfileImpactAnalyzed: false }), {
    websiteOnly: false,
    reason: "Lockfile changes require importer impact analysis to qualify as website-only",
  });

  // Lockfile allowed when explicitly analyzed and all other files are within allowlist
  assert.deepEqual(classifyChange(lockfileWithoutAnalysis, { lockfileImpactAnalyzed: true }), {
    websiteOnly: true,
    reason: "Lockfile impact analyzed and all changes within website allowlist",
  });

  // Lockfile analyzed but touching non-allowlist files remains rejected
  const lockfileWithCoreChanges = ["packages/core/package.json", "pnpm-lock.yaml"];
  assert.equal(
    classifyChange(lockfileWithCoreChanges, { lockfileImpactAnalyzed: true }).websiteOnly,
    false,
  );
});

test("selectPublication: selects verified releases using semver comparison", () => {
  // Empty or invalid input
  assert.equal(selectPublication([]), null);
  assert.equal(selectPublication(null), null);

  // Ignores unverified publications or pending publications
  const unverifiedList = [
    {
      version: "1.0.0",
      channel: "latest",
      tag: "v1.0.0",
      integrity: "sha512-abc",
      verified: false,
    },
    {
      version: "1.1.0-beta.1",
      channel: "next",
      tag: "v1.1.0-beta.1",
      integrity: "sha512-def",
      verified: "publication-pending",
    },
    {
      version: "1.0.1",
      channel: "latest",
      tag: "v1.0.1",
      integrity: "",
      verified: true,
    },
  ];
  assert.equal(selectPublication(unverifiedList), null);

  // Ignores malformed SemVer without crashing
  const withMalformedSemver = [
    {
      version: "invalid-version",
      channel: "latest",
      tag: "invalid",
      integrity: "sha512-inv",
      verified: true,
    },
    {
      version: "1.0.0",
      channel: "latest",
      tag: "v1.0.0",
      integrity: "sha512-valid",
      verified: true,
    },
  ];
  assert.equal(selectPublication(withMalformedSemver)?.version, "1.0.0");

  // Supports verifiedAt timestamp schema emitted by GitHub Actions
  const withVerifiedAt = [
    {
      version: "1.0.5",
      channel: "latest",
      tag: "v1.0.5",
      integrity: "sha512-valid5",
      verifiedAt: "2026-09-13T12:00:00Z",
    },
  ];
  assert.equal(selectPublication(withVerifiedAt)?.version, "1.0.5");

  // Prefers highest verified stable version over newer beta version
  const mixedPublications = [
    {
      version: "1.0.0",
      channel: "latest",
      tag: "v1.0.0",
      integrity: "sha512-v100",
      verified: true,
    },
    {
      version: "1.1.0-beta.1",
      channel: "next",
      tag: "v1.1.0-beta.1",
      integrity: "sha512-v110b1",
      verified: true,
    },
    {
      version: "1.0.1",
      channel: "latest",
      tag: "v1.0.1",
      integrity: "sha512-v101",
      verified: true,
    },
  ];
  const selectedStable = selectPublication(mixedPublications);
  assert.ok(selectedStable);
  assert.equal(selectedStable.version, "1.0.1");
  assert.equal(selectedStable.channel, "latest");

  // Uses SemVer comparison, not lexical sorting (1.10.0 > 1.9.0)
  const lexicalTrapList = [
    {
      version: "1.9.0",
      channel: "latest",
      tag: "v1.9.0",
      integrity: "sha512-v190",
      verified: true,
    },
    {
      version: "1.10.0",
      channel: "latest",
      tag: "v1.10.0",
      integrity: "sha512-v1100",
      verified: true,
    },
  ];
  assert.equal(selectPublication(lexicalTrapList)?.version, "1.10.0");

  // In absence of stable version, selects highest verified beta version
  const betaOnlyList = [
    {
      version: "0.1.0-beta.1",
      channel: "next",
      tag: "v0.1.0-beta.1",
      integrity: "sha512-b1",
      verified: true,
    },
    {
      version: "0.1.0-beta.2",
      channel: "next",
      tag: "v0.1.0-beta.2",
      integrity: "sha512-b2",
      verified: true,
    },
  ];
  const selectedBeta = selectPublication(betaOnlyList);
  assert.ok(selectedBeta);
  assert.equal(selectedBeta.version, "0.1.0-beta.2");
  assert.equal(selectedBeta.channel, "next");
});

test("evaluateDeployPromotion: Case 1 - CI failure or PR/fork event rejects production promotion", () => {
  const baseContext = {
    event: "push",
    conclusion: "success",
    branch: "main",
    isFork: false,
    changedFiles: ["apps/website/src/pages/index.astro"],
    publications: [
      {
        version: "1.0.0",
        channel: "latest",
        tag: "v1.0.0",
        integrity: "sha512-test",
        verified: true,
      },
    ],
  };

  // CI failure
  const failDecision = evaluateDeployPromotion({
    ...baseContext,
    conclusion: "failure",
  });
  assert.equal(failDecision.status, "reject");
  assert.equal(failDecision.reason, "CI failed or non-main event");

  // PR event
  const prDecision = evaluateDeployPromotion({
    ...baseContext,
    event: "pull_request",
  });
  assert.equal(prDecision.status, "reject");
  assert.equal(prDecision.reason, "CI failed or non-main event");

  // Fork repository
  const forkDecision = evaluateDeployPromotion({
    ...baseContext,
    isFork: true,
  });
  assert.equal(forkDecision.status, "reject");
  assert.equal(forkDecision.reason, "CI failed or non-main event");

  // Non-main branch
  const branchDecision = evaluateDeployPromotion({
    ...baseContext,
    branch: "feature/preview-docs",
  });
  assert.equal(branchDecision.status, "reject");
  assert.equal(branchDecision.reason, "CI failed or non-main event");
});

test("evaluateDeployPromotion: Case 2 - Website-only commit with CI success on main promotes website", () => {
  const decision = evaluateDeployPromotion({
    event: "push",
    conclusion: "success",
    branch: "main",
    isFork: false,
    changedFiles: ["apps/website/src/pages/index.astro", "docs/deployment/website-validation.md"],
    publications: [
      {
        version: "1.0.0",
        channel: "latest",
        tag: "v1.0.0",
        integrity: "sha512-test",
        verified: true,
      },
    ],
  });

  assert.equal(decision.status, "promote_website");
  assert.equal(decision.version, "1.0.0");
  assert.equal(decision.channel, "latest");
  assert.ok(decision.publication);
});

test("evaluateDeployPromotion: Case 3 - Mixed core + website commit waits for release", () => {
  const decision = evaluateDeployPromotion({
    event: "push",
    conclusion: "success",
    branch: "main",
    isFork: false,
    changedFiles: ["packages/core/src/index.ts", "apps/website/src/pages/index.astro"],
    publications: [
      {
        version: "1.0.0",
        channel: "latest",
        tag: "v1.0.0",
        integrity: "sha512-test",
        verified: true,
      },
    ],
  });

  assert.equal(decision.status, "wait_for_release");
  assert.match(decision.reason, /Disallowed file outside website scope/);
});

test("evaluateDeployPromotion: Case 4 - Commit touching pnpm-lock.yaml without importer impact analysis", () => {
  // Without analysis: wait_for_release
  const withoutAnalysis = evaluateDeployPromotion({
    event: "push",
    conclusion: "success",
    branch: "main",
    isFork: false,
    changedFiles: ["pnpm-lock.yaml", "apps/website/package.json"],
    lockfileImpactAnalyzed: false,
    publications: [
      {
        version: "1.0.0",
        channel: "latest",
        tag: "v1.0.0",
        integrity: "sha512-test",
        verified: true,
      },
    ],
  });

  assert.equal(withoutAnalysis.status, "wait_for_release");
  assert.match(withoutAnalysis.reason, /Lockfile changes require importer impact analysis/);

  // With explicit analysis proving no core / workspace changes: allows promote_website
  const withAnalysis = evaluateDeployPromotion({
    event: "push",
    conclusion: "success",
    branch: "main",
    isFork: false,
    changedFiles: ["pnpm-lock.yaml", "apps/website/package.json"],
    lockfileImpactAnalyzed: true,
    publications: [
      {
        version: "1.0.0",
        channel: "latest",
        tag: "v1.0.0",
        integrity: "sha512-test",
        verified: true,
      },
    ],
  });

  assert.equal(withAnalysis.status, "promote_website");
  assert.equal(withAnalysis.version, "1.0.0");
});

test("evaluateDeployPromotion: Case 5 - Verified release with no existing stable promotes beta", () => {
  const decision = evaluateDeployPromotion({
    event: "release",
    conclusion: "success",
    branch: "main",
    isFork: false,
    currentSite: null,
    publications: [
      {
        version: "0.1.0-beta.1",
        channel: "next",
        tag: "v0.1.0-beta.1",
        integrity: "sha512-beta1",
        verified: true,
      },
    ],
  });

  assert.equal(decision.status, "promote_release");
  assert.equal(decision.channel, "next");
  assert.equal(decision.version, "0.1.0-beta.1");
  assert.ok(decision.publication);
});

test("evaluateDeployPromotion: Case 6 - Newer beta release preserves already promoted stable version", () => {
  const currentSite = {
    version: "1.0.0",
    channel: "latest",
    sha: "1111111111111111111111111111111111111111",
  };

  const decision = evaluateDeployPromotion({
    event: "release",
    conclusion: "success",
    branch: "main",
    isFork: false,
    currentSite,
    candidatePublication: {
      version: "1.1.0-beta.1",
      channel: "next",
      tag: "v1.1.0-beta.1",
      integrity: "sha512-beta2",
      verified: true,
    },
    publications: [
      {
        version: "1.0.0",
        channel: "latest",
        tag: "v1.0.0",
        integrity: "sha512-v100",
        verified: true,
      },
      {
        version: "1.1.0-beta.1",
        channel: "next",
        tag: "v1.1.0-beta.1",
        integrity: "sha512-beta2",
        verified: true,
      },
    ],
  });

  assert.equal(decision.status, "keep_stable");
  assert.equal(decision.preservedVersion, "1.0.0");
  assert.equal(decision.candidateVersion, "1.1.0-beta.1");
  assert.match(decision.reason, /preserving stable recommendation/);
});

test("evaluateDeployPromotion: Case 7 - Candidate site SHA older than current promoted site triggers reconciliation", () => {
  const currentSite = {
    version: "1.0.0",
    channel: "latest",
    sha: "2222222222222222222222222222222222222222",
  };
  const candidateSite = {
    version: "1.0.1",
    channel: "latest",
    sha: "1111111111111111111111111111111111111111",
    isOlder: true,
  };

  const decision = evaluateDeployPromotion({
    event: "release",
    conclusion: "success",
    branch: "main",
    isFork: false,
    currentSite,
    candidateSite,
    isAncestor: (candSha, currSha) => candSha === candidateSite.sha && currSha === currentSite.sha,
    publications: [
      {
        version: "1.0.1",
        channel: "latest",
        tag: "v1.0.1",
        integrity: "sha512-v101",
        verified: true,
      },
    ],
  });

  assert.equal(decision.status, "reconcile_current_site");
  assert.equal(decision.currentSiteSha, currentSite.sha);
  assert.equal(decision.candidateSiteSha, candidateSite.sha);
  assert.match(decision.reason, /Candidate site SHA is older than current promoted site/);
});

test("evaluateDeployPromotion: Case 8 - Retry/rerun with identical version and SHA allows idempotent redeploy", () => {
  const currentSite = {
    version: "1.0.0",
    channel: "latest",
    sha: "3333333333333333333333333333333333333333",
  };
  const candidateSite = {
    version: "1.0.0",
    channel: "latest",
    sha: "3333333333333333333333333333333333333333",
  };

  const decision = evaluateDeployPromotion({
    event: "push",
    conclusion: "success",
    branch: "main",
    isFork: false,
    currentSite,
    candidateSite,
    publications: [
      {
        version: "1.0.0",
        channel: "latest",
        tag: "v1.0.0",
        integrity: "sha512-v100",
        verified: true,
      },
    ],
  });

  assert.equal(decision.status, "idempotent_redeploy");
  assert.equal(decision.version, "1.0.0");
  assert.equal(decision.sha, currentSite.sha);
  assert.match(decision.reason, /identical/i);
});

test("evaluateDeployPromotion: out-of-order release attempting to downgrade current version is rejected", () => {
  const currentSite = {
    version: "1.0.5",
    channel: "latest",
    sha: "2222222222222222222222222222222222222222",
  };
  const decision = evaluateDeployPromotion({
    event: "release",
    conclusion: "success",
    branch: "main",
    isFork: false,
    currentSite,
    candidatePublication: {
      version: "1.0.4",
      channel: "latest",
      tag: "v1.0.4",
      integrity: "sha512-v104",
      verified: true,
    },
  });

  assert.equal(decision.status, "reject");
  assert.match(decision.reason, /Candidate version is older than currently promoted version/);
});

test("evaluateDeployPromotion: beta release with older commit SHA preserves existing stable site", () => {
  const currentSite = {
    version: "1.0.0",
    channel: "latest",
    sha: "2222222222222222222222222222222222222222",
  };
  const candidateSite = {
    version: "1.1.0-beta.1",
    channel: "next",
    sha: "1111111111111111111111111111111111111111",
    isOlder: true,
  };

  const decision = evaluateDeployPromotion({
    event: "release",
    conclusion: "success",
    branch: "main",
    isFork: false,
    currentSite,
    candidateSite,
    isAncestor: () => true,
    candidatePublication: {
      version: "1.1.0-beta.1",
      channel: "next",
      tag: "v1.1.0-beta.1",
      integrity: "sha512-b1",
      verified: true,
    },
  });

  assert.equal(decision.status, "keep_stable");
  assert.equal(decision.preservedVersion, "1.0.0");
  assert.match(decision.reason, /preserving stable recommendation/);
});

test("evaluateDeployPromotion: unverified candidatePublication is rejected", () => {
  const decision = evaluateDeployPromotion({
    event: "release",
    conclusion: "success",
    branch: "main",
    isFork: false,
    candidatePublication: {
      version: "1.0.0",
      channel: "latest",
      tag: "v1.0.0",
      integrity: "sha512-test",
      verified: false,
    },
  });

  assert.equal(decision.status, "reject");
  assert.equal(decision.reason, "Candidate publication is not verified");
});

test("evaluateDeployPromotion: candidate site with older SHA and equal or older version is rejected", () => {
  const currentSite = {
    version: "1.0.0",
    channel: "latest",
    sha: "2222222222222222222222222222222222222222",
  };
  const candidateSite = {
    version: "1.0.0",
    channel: "latest",
    sha: "1111111111111111111111111111111111111111",
    isOlder: true,
  };

  const decision = evaluateDeployPromotion({
    event: "release",
    conclusion: "success",
    branch: "main",
    isFork: false,
    currentSite,
    candidateSite,
    isAncestor: () => true,
    candidatePublication: {
      version: "1.0.0",
      channel: "latest",
      tag: "v1.0.0",
      integrity: "sha512-v100",
      verified: true,
    },
  });

  assert.equal(decision.status, "reject");
  assert.match(decision.reason, /Candidate site SHA is older and candidate version is not newer/);
});

test("evaluateDeployPromotion: handles currentSite with siteSha property from /version.json", () => {
  const currentSite = {
    version: "1.0.0",
    channel: "latest",
    siteSha: "3333333333333333333333333333333333333333",
  };
  const candidateSite = {
    version: "1.0.0",
    channel: "latest",
    siteSha: "3333333333333333333333333333333333333333",
  };

  const decision = evaluateDeployPromotion({
    event: "push",
    conclusion: "success",
    branch: "main",
    isFork: false,
    currentSite,
    candidateSite,
    publications: [
      {
        version: "1.0.0",
        channel: "latest",
        tag: "v1.0.0",
        integrity: "sha512-v100",
        verified: true,
      },
    ],
  });

  assert.equal(decision.status, "idempotent_redeploy");
  assert.equal(decision.version, "1.0.0");
  assert.equal(decision.sha, currentSite.siteSha);
});

test("schema and helper validators: isValidSemver and isVerifiedPublication", () => {
  assert.equal(isValidSemver("1.0.0"), true);
  assert.equal(isValidSemver("1.0.0-beta.1"), true);
  assert.equal(isValidSemver("invalid"), false);
  assert.equal(isValidSemver(null), false);

  assert.equal(isVerifiedPublication(null), false);
  assert.equal(
    isVerifiedPublication({
      version: "1.0.0",
      integrity: "sha512-abc",
      verified: true,
    }),
    true,
  );
  assert.equal(
    isVerifiedPublication({
      version: "1.0.0",
      integrity: "sha512-abc",
      verifiedAt: "2026-09-13T12:00:00Z",
    }),
    true,
  );
  assert.equal(
    isVerifiedPublication({
      version: "1.0.0",
      integrity: "",
      verified: true,
    }),
    false,
  );
  assert.equal(
    isVerifiedPublication({
      version: "1.0.0",
      integrity: "sha512-abc",
      verified: "publication-pending",
    }),
    false,
  );
  assert.equal(
    isVerifiedPublication({
      version: "not-semver",
      integrity: "sha512-abc",
      verified: true,
    }),
    false,
  );
});

test("CLI execution outputs JSON for evaluate and classify commands", () => {
  // classify command
  const classifyOutput = execFileSync(
    process.execPath,
    [
      cliScriptPath,
      "classify",
      "--files",
      "apps/website/src/pages/index.astro,docs/deployment/website-validation.md",
    ],
    { encoding: "utf8" },
  );
  const parsedClassify = JSON.parse(classifyOutput);
  assert.equal(parsedClassify.websiteOnly, true);

  // evaluate command with JSON string
  const evalInput = JSON.stringify({
    event: "push",
    conclusion: "success",
    branch: "main",
    isFork: false,
    changedFiles: ["apps/website/src/pages/index.astro"],
    publications: [
      {
        version: "1.0.0",
        channel: "latest",
        tag: "v1.0.0",
        integrity: "sha512-test",
        verified: true,
      },
    ],
  });

  const evalOutput = execFileSync(
    process.execPath,
    [cliScriptPath, "evaluate", "--input", evalInput],
    { encoding: "utf8" },
  );
  const parsedEval = JSON.parse(evalOutput);
  assert.equal(parsedEval.status, "promote_website");
  assert.equal(parsedEval.version, "1.0.0");

  // select-publication command
  const selectOutput = execFileSync(
    process.execPath,
    [
      cliScriptPath,
      "select-publication",
      "--input",
      JSON.stringify([
        {
          version: "1.0.0",
          channel: "latest",
          integrity: "sha512-test",
          verified: true,
        },
      ]),
    ],
    { encoding: "utf8" },
  );
  const parsedSelect = JSON.parse(selectOutput);
  assert.equal(parsedSelect.version, "1.0.0");
});

test("isGitAncestor: correctly checks git ancestry", (t) => {
  assert.equal(isGitAncestor("", ""), false);
  assert.equal(isGitAncestor("abc", ""), false);
  assert.equal(isGitAncestor("abc", "abc"), true);

  const cwd = mkdtempSync(path.join(os.tmpdir(), "aik-ancestry-"));
  t.after(() => rmSync(cwd, { recursive: true, force: true }));
  const git = (...args) => execFileSync("git", args, { cwd, encoding: "utf8" }).trim();
  git("init", "--quiet");
  const commit = (message) => {
    git(
      "-c",
      "user.name=AIK Test",
      "-c",
      "user.email=test@example.invalid",
      "-c",
      "commit.gpgsign=false",
      "commit",
      "--quiet",
      "--allow-empty",
      "-m",
      message,
    );
    return git("rev-parse", "HEAD");
  };
  const parent = commit("parent");
  const child = commit("child");

  assert.equal(isGitAncestor(parent, child, { cwd }), true);
  assert.equal(isGitAncestor(child, parent, { cwd }), false);
});
