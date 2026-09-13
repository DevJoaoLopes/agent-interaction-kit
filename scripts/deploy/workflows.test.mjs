import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import YAML from "yaml";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "../..");

const deployWorkflowPath = path.join(root, ".github/workflows/deploy-website.yml");
const websiteMainWorkflowPath = path.join(root, ".github/workflows/website-main.yml");
const releaseWorkflowPath = path.join(root, ".github/workflows/release.yml");
const docsHealthWorkflowPath = path.join(root, ".github/workflows/docs-health.yml");
const ciWorkflowPath = path.join(root, ".github/workflows/ci.yml");

test("deploy-website.yml: parses cleanly and defines workflow_call and workflow_dispatch triggers", () => {
  assert.ok(existsSync(deployWorkflowPath), "deploy-website.yml must exist");
  const raw = readFileSync(deployWorkflowPath, "utf8");
  const doc = YAML.parse(raw);

  assert.equal(doc.name, "Deploy Website");

  // Trigger: workflow_call
  assert.ok(doc.on?.workflow_call, "Must define workflow_call trigger");
  const callInputs = doc.on.workflow_call.inputs;
  assert.ok(callInputs["site-sha"], "Must require site-sha input");
  assert.equal(callInputs["site-sha"].required, true);
  assert.equal(callInputs["site-sha"].type, "string");

  assert.ok(callInputs["release-tag"], "Must require release-tag input");
  assert.equal(callInputs["release-tag"].required, true);
  assert.equal(callInputs["release-tag"].type, "string");

  assert.ok(callInputs["package-version"], "Must require package-version input");
  assert.equal(callInputs["package-version"].required, true);
  assert.equal(callInputs["package-version"].type, "string");

  assert.ok(callInputs.reason, "Must require reason input");
  assert.equal(callInputs.reason.required, true);
  assert.equal(callInputs.reason.type, "string");

  // Trigger: workflow_dispatch
  assert.ok(doc.on?.workflow_dispatch, "Must define workflow_dispatch trigger");
  const dispatchInputs = doc.on.workflow_dispatch.inputs;
  assert.ok(dispatchInputs["site-sha"]);
  assert.ok(dispatchInputs["release-tag"]);
  assert.ok(dispatchInputs["package-version"]);
  assert.ok(dispatchInputs.reason);
  assert.equal(dispatchInputs.reason.type, "choice");
  assert.deepEqual(dispatchInputs.reason.options, ["recovery", "release", "website"]);
  assert.equal(dispatchInputs.reason.default, "recovery");
});

test("deploy-website.yml: enforces security boundaries, permissions, and concurrency", () => {
  const raw = readFileSync(deployWorkflowPath, "utf8");
  const doc = YAML.parse(raw);

  // Concurrency group and settings
  assert.deepEqual(doc.concurrency, {
    group: "aik-site-production",
    "cancel-in-progress": false,
  });

  // Strict read-only permissions (no write permissions, no id-token)
  assert.deepEqual(doc.permissions, {
    contents: "read",
  });

  // Zero-secrets policy check: no npm tokens or release app keys in deploy workflow
  assert.doesNotMatch(raw, /NPM_TOKEN/);
  assert.doesNotMatch(raw, /NODE_AUTH_TOKEN/);
  assert.doesNotMatch(raw, /RELEASE_APP_PRIVATE_KEY/);
  assert.doesNotMatch(raw, /RELEASE_APP_ID/);
  assert.doesNotMatch(raw, /id-token:\s*write/);

  // Dedicated vercel-production environment
  const deployJob = doc.jobs?.deploy;
  assert.ok(deployJob, "Must define deploy job");
  assert.equal(deployJob["runs-on"], "ubuntu-latest");
  assert.equal(deployJob.environment, "vercel-production");
});

test("deploy-website.yml: pins action SHAs with human-readable version comments", () => {
  const raw = readFileSync(deployWorkflowPath, "utf8");

  // Checkout pinned to exact commit SHA with comment
  assert.match(raw, /actions\/checkout@11bd71901bbe5b1630ceea73d27597364c9af683\s+#\s+v4\.2\.2/);

  // pnpm setup pinned
  assert.match(raw, /pnpm\/action-setup@b906affcce14559ad1aafd4ab0e942779e9f58b1\s+#\s+v4\.1\.0/);

  // setup-node pinned
  assert.match(raw, /actions\/setup-node@49933ea5288caeca8642d1e84afbd3f7d6820020\s+#\s+v4\.4\.0/);
});

test("deploy-website.yml: verifies ancestry, inputs, quality gates, candidate deployment, and promotion", () => {
  const raw = readFileSync(deployWorkflowPath, "utf8");

  // Input validation step
  assert.ok(raw.includes("^[0-9a-fA-F]{40}$"), "Must validate 40-hex SHA");
  assert.match(raw, /EXPECTED_TAG="v\$\{PKG_VERSION\}"/);

  // Ancestry check against origin/main
  assert.match(raw, /git merge-base --is-ancestor/);
  assert.match(raw, /origin\/main/);

  // Quality gates on candidate code
  assert.match(raw, /pnpm check/);
  assert.match(raw, /pnpm knip/);
  assert.match(raw, /pnpm typecheck/);
  assert.match(raw, /pnpm test/);

  // Vercel CLI workflow
  assert.match(raw, /pnpm exec vercel pull --yes --environment=production/);
  assert.match(raw, /PUBLIC_AIK_VERSION/);
  assert.match(raw, /PUBLIC_AIK_RELEASE_TAG/);
  assert.match(raw, /PUBLIC_SITE_SHA/);
  assert.match(raw, /SITE_URL/);
  assert.match(raw, /VERCEL_ENV: production/);
  assert.match(raw, /pnpm exec vercel build --prod/);
  assert.match(raw, /pnpm exec vercel deploy --prebuilt --prod --skip-domain/);

  // Candidate verification before promotion
  assert.match(raw, /node scripts\/docs\/verify-published\.mjs/);
  assert.match(raw, /SITE_TEST_URL="\$DEPLOY_URL"\s+pnpm test:web/);

  // Pre-promotion freshness revalidation
  assert.match(raw, /name: Revalidate freshness immediately prior to promotion/);
  assert.match(raw, /compareSemver/);
  assert.match(raw, /git merge-base --is-ancestor/);
  assert.match(raw, /Recovery deployment bypasses freshness checks/);

  // Vercel promotion
  assert.match(raw, /pnpm exec vercel promote "\$DEPLOY_URL" --yes/);

  // Public domain verification
  assert.match(raw, /\/version\.json/);
  assert.match(raw, /\/robots\.txt/);
  assert.match(raw, /\/sitemap\.xml/);
  assert.match(raw, /\/examples\/provider\.json/);
  assert.match(raw, /\/examples\/consumer\.json/);
  assert.match(raw, /rel=\\"canonical\\"/);
  assert.match(raw, /attempt \$\{i\}\/12/);
});

test("website-main.yml: parses cleanly and triggers on CI Matrix push to main", () => {
  assert.ok(existsSync(websiteMainWorkflowPath), "website-main.yml must exist");
  const raw = readFileSync(websiteMainWorkflowPath, "utf8");
  const doc = YAML.parse(raw);

  assert.equal(doc.name, "Website Main Promotion");

  // Trigger: workflow_run on CI Matrix completed
  assert.ok(doc.on?.workflow_run);
  assert.deepEqual(doc.on.workflow_run.workflows, ["CI Matrix"]);
  assert.deepEqual(doc.on.workflow_run.types, ["completed"]);

  // Permissions: read-only
  assert.deepEqual(doc.permissions, {
    contents: "read",
    actions: "read",
  });

  // Guard condition on classify job: push to main on primary repo with success conclusion
  const classifyJob = doc.jobs?.classify;
  assert.ok(classifyJob, "Must define classify job");
  const cond = classifyJob.if;
  assert.match(cond, /github\.event\.workflow_run\.event == 'push'/);
  assert.match(cond, /github\.event\.workflow_run\.head_branch == 'main'/);
  assert.match(cond, /github\.event\.workflow_run\.conclusion == 'success'/);
  assert.match(cond, /github\.repository == 'DevJoaoLopes\/agent-interaction-kit'/);

  // Classify job steps, git diff handling, and exported environment variables
  assert.match(raw, /git diff-tree --no-commit-id --name-only -r -m "\$HEAD_SHA" \| sort -u/);
  assert.match(raw, /export CHANGED_FILES/);
  assert.match(raw, /export PUBLICATIONS/);
  assert.match(raw, /export CURRENT_SITE/);
  assert.match(raw, /scripts\/deploy\/policy\.mjs classify/);
  assert.match(raw, /gh release list/);
  assert.match(raw, /scripts\/deploy\/policy\.mjs evaluate/);

  // Reusable deploy job
  const deployJob = doc.jobs?.deploy;
  assert.ok(deployJob, "Must define deploy job");
  assert.equal(deployJob.needs, "classify");
  assert.equal(deployJob.if, "needs.classify.outputs.should_deploy == 'true'");
  assert.equal(deployJob.uses, "./.github/workflows/deploy-website.yml");
  assert.equal(deployJob.secrets, "inherit");
  assert.equal(deployJob.with["site-sha"], "${{ needs.classify.outputs.site_sha }}");
  assert.equal(deployJob.with["release-tag"], "${{ needs.classify.outputs.release_tag }}");
  assert.equal(deployJob.with["package-version"], "${{ needs.classify.outputs.package_version }}");
  assert.equal(deployJob.with.reason, "${{ needs.classify.outputs.reason }}");
});

test("release.yml: publishes outputs and triggers downstream deploy-site job when verified", () => {
  assert.ok(existsSync(releaseWorkflowPath), "release.yml must exist");
  const raw = readFileSync(releaseWorkflowPath, "utf8");
  const doc = YAML.parse(raw);

  // publish job exposes outputs
  const publishJob = doc.jobs?.publish;
  assert.ok(publishJob, "Must define publish job");
  assert.ok(publishJob.outputs, "publish job must declare outputs");
  assert.equal(publishJob.outputs.published, "${{ steps.meta.outputs.published }}");
  assert.equal(publishJob.outputs.tag, "${{ steps.verify_release.outputs.tag }}");
  assert.equal(publishJob.outputs.sha, "${{ steps.verify_release.outputs.sha }}");
  assert.equal(publishJob.outputs.version, "${{ steps.verify_release.outputs.version }}");

  // deploy-site downstream job
  const deploySiteJob = doc.jobs?.["deploy-site"];
  assert.ok(deploySiteJob, "Must define deploy-site job");
  assert.equal(deploySiteJob.needs, "publish");
  assert.match(
    deploySiteJob.if,
    /needs\.publish\.outputs\.published == 'true' && vars\.NPM_PUBLISH_ENABLED == 'true'/,
  );
  assert.equal(deploySiteJob.uses, "./.github/workflows/deploy-website.yml");
  assert.equal(deploySiteJob.secrets, "inherit");
  assert.equal(deploySiteJob.with["site-sha"], "${{ needs.publish.outputs.sha }}");
  assert.equal(deploySiteJob.with["release-tag"], "${{ needs.publish.outputs.tag }}");
  assert.equal(deploySiteJob.with["package-version"], "${{ needs.publish.outputs.version }}");
  assert.equal(deploySiteJob.with.reason, "release");
});

test("docs-health.yml: parses cleanly, triggers on weekly schedule and workflow_dispatch, and enforces read-only permissions", () => {
  assert.ok(existsSync(docsHealthWorkflowPath), "docs-health.yml must exist");
  const raw = readFileSync(docsHealthWorkflowPath, "utf8");
  const doc = YAML.parse(raw);

  assert.equal(doc.name, "Docs Health");

  // Triggers: schedule and workflow_dispatch
  assert.ok(doc.on?.schedule, "Must define schedule trigger");
  assert.deepEqual(doc.on.schedule, [{ cron: "0 9 * * 1" }]);
  assert.notEqual(doc.on?.workflow_dispatch, undefined, "Must define workflow_dispatch trigger");

  // Permissions strictly contents: read
  assert.deepEqual(doc.permissions, {
    contents: "read",
  });

  // No write permissions or secrets leaking
  assert.doesNotMatch(raw, /issues:\s*write/);
  assert.doesNotMatch(raw, /contents:\s*write/);

  // Pinned action SHAs
  assert.match(raw, /actions\/checkout@11bd71901bbe5b1630ceea73d27597364c9af683\s+#\s+v4\.2\.2/);
  assert.match(raw, /pnpm\/action-setup@b906affcce14559ad1aafd4ab0e942779e9f58b1\s+#\s+v4\.1\.0/);
  assert.match(raw, /actions\/setup-node@49933ea5288caeca8642d1e84afbd3f7d6820020\s+#\s+v4\.4\.0/);

  // Invocations of verify-published.mjs and test:web
  assert.match(raw, /node scripts\/docs\/verify-published\.mjs/);
  assert.match(raw, /pnpm test:web/);
});

test("ci.yml: website job runs pnpm test:docs to validate documentation snippets", () => {
  assert.ok(existsSync(ciWorkflowPath), "ci.yml must exist");
  const raw = readFileSync(ciWorkflowPath, "utf8");
  const doc = YAML.parse(raw);

  const websiteJob = doc.jobs?.website;
  assert.ok(websiteJob, "Must define website job");
  const steps = websiteJob.steps;
  assert.ok(Array.isArray(steps), "Website job steps must be an array");

  const hasTestDocs = steps.some((step) => step.run === "pnpm test:docs");
  assert.ok(hasTestDocs, "Website job must include step running 'pnpm test:docs'");
});
