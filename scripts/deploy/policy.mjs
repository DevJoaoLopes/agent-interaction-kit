import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { compareSemver } from "../release/policy.mjs";

/**
 * Classifies whether git commit changes are isolated to the website scope.
 *
 * Allowlist:
 * - apps/website/...
 * - docs/deployment/...
 * - pnpm-lock.yaml (ONLY when lockfileImpactAnalyzed is true)
 *
 * Any changes to packages/core, .github/, or root config files reject website-only.
 *
 * @param {string[]} changedFiles
 * @param {{ lockfileImpactAnalyzed?: boolean }} [options]
 * @returns {{ websiteOnly: boolean, reason: string }}
 */
export function classifyChange(changedFiles, options = {}) {
  if (!Array.isArray(changedFiles) || changedFiles.length === 0) {
    return {
      websiteOnly: false,
      reason: "No changed files provided",
    };
  }

  const normalizedFiles = changedFiles.map((f) =>
    typeof f === "string" ? f.trim().replace(/^\.\//, "").replace(/\\/g, "/") : "",
  );

  let hasLockfile = false;

  for (const file of normalizedFiles) {
    if (!file) continue;

    if (file === "pnpm-lock.yaml") {
      hasLockfile = true;
      if (!options.lockfileImpactAnalyzed) {
        return {
          websiteOnly: false,
          reason: "Lockfile changes require importer impact analysis to qualify as website-only",
        };
      }
      continue;
    }

    const isWebsite = file.startsWith("apps/website/") || file.startsWith("docs/deployment/");
    if (!isWebsite) {
      return {
        websiteOnly: false,
        reason: `Disallowed file outside website scope: ${file}`,
      };
    }
  }

  return {
    websiteOnly: true,
    reason: hasLockfile
      ? "Lockfile impact analyzed and all changes within website allowlist"
      : "All changes within website allowlist",
  };
}

/**
 * Evaluates verified publications and selects the best candidate using SemVer rules.
 *
 * Rules:
 * - Only verified publications (verified === true, non-empty integrity and version) are evaluated.
 * - Publication-pending and unverified entries are ignored.
 * - Prefers highest verified stable version (channel === "latest" or non-prerelease).
 * - In the absence of a stable version, selects the highest verified beta version (channel === "next").
 * - Comparison is performed via semver comparison, not lexical sorting or date.
 *
 * @param {Array<{ version: string, channel: string, tag?: string, integrity?: string, verified?: boolean|string }>} publications
 * @returns {object|null}
 */
export function selectPublication(publications) {
  if (!Array.isArray(publications) || publications.length === 0) {
    return null;
  }

  const verifiedPubs = publications.filter(
    (pub) =>
      pub &&
      pub.verified === true &&
      typeof pub.version === "string" &&
      pub.version.trim() !== "" &&
      typeof pub.integrity === "string" &&
      pub.integrity.trim() !== "",
  );

  if (verifiedPubs.length === 0) {
    return null;
  }

  const stablePubs = verifiedPubs.filter(
    (p) => p.channel === "latest" || !p.version.includes("-beta."),
  );

  if (stablePubs.length > 0) {
    stablePubs.sort((a, b) => compareSemver(b.version, a.version));
    return stablePubs[0];
  }

  const betaPubs = verifiedPubs.filter((p) => p.channel === "next" || p.version.includes("-beta."));

  if (betaPubs.length > 0) {
    betaPubs.sort((a, b) => compareSemver(b.version, a.version));
    return betaPubs[0];
  }

  return null;
}

/**
 * Checks whether an ancestor commit is an ancestor of a descendant commit.
 *
 * @param {string} ancestorSha
 * @param {string} descendantSha
 * @param {{ cwd?: string }} [options]
 * @returns {boolean}
 */
export function isGitAncestor(ancestorSha, descendantSha, options = {}) {
  if (!ancestorSha || !descendantSha) return false;
  if (ancestorSha === descendantSha) return true;
  try {
    execFileSync("git", ["merge-base", "--is-ancestor", ancestorSha, descendantSha], {
      cwd: options.cwd || process.cwd(),
      stdio: "ignore",
    });
    return true;
  } catch {
    return false;
  }
}

/**
 * Evaluates deploy and promotion eligibility based on event metadata, git history,
 * change scope, and verified publication assets.
 *
 * Decision Cases:
 * 1. CI failure or PR/fork event -> status: "reject" (reason: "CI failed or non-main event")
 * 2. Website-only commit, CI success on main, verified publication available -> status: "promote_website"
 * 3. Mixed core + website commit -> status: "wait_for_release"
 * 4. Commit touching pnpm-lock.yaml without importer impact analysis -> status: "wait_for_release"
 * 5. Verified release, no existing stable -> status: "promote_release", channel: "next"
 * 6. Newer beta release when a stable version is already promoted -> status: "keep_stable"
 * 7. Candidate site SHA is older than current promoted site -> status: "reconcile_current_site"
 * 8. Retry/rerun of deploy with identical version and identical SHA -> status: "idempotent_redeploy"
 */
export function evaluateDeployPromotion({
  event = "push",
  conclusion,
  branch,
  isFork = false,
  changedFiles,
  currentSite,
  candidateSite,
  publications = [],
  candidatePublication,
  lockfileImpactAnalyzed = false,
  isAncestor,
}) {
  // Case 1: CI failure, PR event, fork, or non-main branch
  if (
    conclusion !== "success" ||
    isFork === true ||
    event === "pull_request" ||
    (branch !== undefined && branch !== null && branch !== "main")
  ) {
    return {
      status: "reject",
      reason: "CI failed or non-main event",
    };
  }

  const selectedPub = selectPublication(publications);
  const resolvedCandidatePub = candidatePublication || selectedPub;

  const currentSha = currentSite?.sha;
  const candidateSha = candidateSite?.sha;
  const currentVersion = currentSite?.version;
  const candidateVersion = candidateSite?.version || resolvedCandidatePub?.version;

  // Case 8: Retry/rerun of deploy with identical version and identical SHA
  if (
    currentSha &&
    candidateSha &&
    currentSha === candidateSha &&
    currentVersion &&
    candidateVersion &&
    currentVersion === candidateVersion
  ) {
    return {
      status: "idempotent_redeploy",
      version: currentVersion,
      sha: currentSha,
      reason: `Identical version (${currentVersion}) and commit SHA (${currentSha}) already promoted. Allowing verification and redeployment without republishing.`,
    };
  }

  // Case 7: Candidate site SHA is older than current promoted site
  let isCandidateOlder = false;
  if (currentSha && candidateSha && currentSha !== candidateSha) {
    if (typeof candidateSite?.isOlder === "boolean") {
      isCandidateOlder = candidateSite.isOlder;
    } else if (typeof isAncestor === "function") {
      isCandidateOlder = isAncestor(candidateSha, currentSha);
    } else {
      isCandidateOlder = isGitAncestor(candidateSha, currentSha);
    }
  }

  if (isCandidateOlder) {
    return {
      status: "reconcile_current_site",
      currentSiteSha: currentSha,
      candidateSiteSha: candidateSha,
      publication: resolvedCandidatePub,
      reason:
        "Candidate site SHA is older than current promoted site; reconciling current site with new version",
    };
  }

  // Cases 2, 3, 4: Commit change classification
  if (Array.isArray(changedFiles) && changedFiles.length > 0) {
    const classification = classifyChange(changedFiles, {
      lockfileImpactAnalyzed,
    });
    if (!classification.websiteOnly) {
      return {
        status: "wait_for_release",
        reason: classification.reason,
      };
    }

    if (!resolvedCandidatePub) {
      return {
        status: "reject",
        reason: "No verified publication available for website deployment",
      };
    }

    return {
      status: "promote_website",
      channel: resolvedCandidatePub.channel,
      version: resolvedCandidatePub.version,
      publication: resolvedCandidatePub,
      reason: "Website-only commit with verified publication available",
    };
  }

  // Release promotion (Cases 5 & 6)
  if (!resolvedCandidatePub) {
    return {
      status: "reject",
      reason: "No verified publication available",
    };
  }

  const isCurrentStable = Boolean(
    currentSite &&
      (currentSite.channel === "latest" || (currentVersion && !currentVersion.includes("-beta."))),
  );

  const candidateChannel =
    resolvedCandidatePub.channel ||
    (resolvedCandidatePub.version.includes("-beta.") ? "next" : "latest");

  const isCandidateBeta =
    candidateChannel === "next" || resolvedCandidatePub.version.includes("-beta.");

  // Case 6: Newer beta release when a stable version is already promoted
  if (isCurrentStable && isCandidateBeta) {
    return {
      status: "keep_stable",
      preservedVersion: currentVersion,
      candidateVersion: resolvedCandidatePub.version,
      reason: `Stable version ${currentVersion} is already promoted; preserving stable recommendation instead of replacing with beta ${resolvedCandidatePub.version}`,
    };
  }

  // Case 5: Verified release, no existing stable -> publish/promote beta
  return {
    status: "promote_release",
    channel: candidateChannel,
    version: resolvedCandidatePub.version,
    publication: resolvedCandidatePub,
    reason:
      !isCurrentStable && isCandidateBeta
        ? "Verified beta release with no existing stable version promoted"
        : "Verified release ready for promotion",
  };
}

// CLI execution support
const isCli =
  Boolean(process.argv[1]) && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isCli) {
  const args = process.argv.slice(2);
  const command = args[0];

  function getArgValue(flag) {
    const idx = args.indexOf(flag);
    return idx !== -1 && idx + 1 < args.length ? args[idx + 1] : null;
  }

  function readInput(flag = "--input") {
    const raw = getArgValue(flag);
    if (!raw) {
      if (args[1] && !args[1].startsWith("--")) {
        return args[1];
      }
      return null;
    }
    try {
      return JSON.parse(raw);
    } catch {
      try {
        return JSON.parse(readFileSync(raw, "utf8"));
      } catch {
        return raw;
      }
    }
  }

  try {
    if (command === "classify") {
      const filesArg = getArgValue("--files");
      const lockfileImpactAnalyzed = args.includes("--lockfile-analyzed");
      const files = filesArg ? filesArg.split(",").map((f) => f.trim()) : [];
      const result = classifyChange(files, { lockfileImpactAnalyzed });
      console.log(JSON.stringify(result, null, 2));
    } else if (command === "select-publication") {
      const input = readInput();
      const publications = Array.isArray(input) ? input : [];
      const result = selectPublication(publications);
      console.log(JSON.stringify(result, null, 2));
    } else if (command === "evaluate") {
      const input = readInput();
      const evalContext = input && typeof input === "object" && !Array.isArray(input) ? input : {};
      const result = evaluateDeployPromotion(evalContext);
      console.log(JSON.stringify(result, null, 2));
    } else {
      console.error(
        "Usage: node scripts/deploy/policy.mjs <classify|select-publication|evaluate> [options]",
      );
      process.exit(1);
    }
  } catch (err) {
    console.error(`Execution error: ${err.message}`);
    process.exit(1);
  }
}
