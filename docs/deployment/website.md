# Website deployment

## Local development and testing

Use Node 24 and pnpm 10.26.1. From the repository root:

```sh
pnpm install --frozen-lockfile
pnpm dev:web
```

`pnpm build:web` builds the core first, validates the website examples against it, then generates `apps/website/dist`. The browser never receives the Node CLI or Ajv. 

Run the test suite locally:

```sh
pnpm test:docs    # Validates doc snippets, manifest schemas, and consumer installation
pnpm test:web     # Runs Playwright browser and accessibility checks on built site
```

The core remains independently buildable on Node 20.

## Vercel project configuration

Import `DevJoaoLopes/agent-interaction-kit` in the intended Vercel account/team:

| Setting | Value | Rationale |
| --- | --- | --- |
| Framework | Astro | Astro static build optimizations |
| Root Directory | `apps/website` | Isolates website workspace |
| Node.js | 24.x | Modern Node runtime for Astro 7 |
| Install Command | `pnpm install --frozen-lockfile` | Deterministic root lockfile install |
| Build Command | `pnpm build` | Compiles core, validates examples, builds site |
| Output Directory | `dist` | Static build artifacts |
| Production Branch | `main` | Production branch reference |

Enable inclusion of workspace files outside the Root Directory in Vercel project settings. Vercel must see the root lockfile and `packages/core`.

PR branches produce isolated preview deployments automatically through the Vercel Git integration. Previews emit `noindex` and disallow crawling to prevent search engine indexing.

## Production gating and promotion architecture

Automatic promotion to production on merge or push to `main` is disabled at the project configuration level in `apps/website/vercel.json`:

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "git": {
    "deploymentEnabled": {
      "main": false
    }
  }
}
```

Production promotion happens strictly through automated GitHub Actions workflows:

1. **`deploy-website.yml` (Reusable Promotion Workflow)**:
   - Runs in the isolated `vercel-production` environment with strict `contents: read` permissions.
   - Enforces concurrency locking (`aik-site-production`, `cancel-in-progress: false`).
   - Requires verified inputs: `site-sha` (40-hex Git SHA), `release-tag`, `package-version`, and promotion `reason` (`release`, `website`, or `recovery`).
   - Verifies that `site-sha` is an ancestor of `origin/main`.
   - Runs candidate quality gates (`pnpm check`, `pnpm knip`, `pnpm typecheck`, `pnpm test`).
   - Performs prebuilt candidate deployment using `vercel deploy --prebuilt --prod --skip-domain`.
   - Verifies the candidate deployment URL with `scripts/docs/verify-published.mjs` and Playwright tests (`pnpm test:web`).
   - Revalidates SemVer and Git ancestry freshness immediately before promotion to prevent downgrades or out-of-order promotions.
   - Promotes the deployment with `vercel promote`.
   - Verifies the public production origin (`/version.json`, `/`, `/docs/`, `/examples/provider.json`, `/examples/consumer.json`, `/robots.txt`, `/sitemap.xml`).

2. **`website-main.yml` (Website-Only Main Promotion)**:
   - Triggers on successful completion of the `CI Matrix` workflow for pushes to `main`.
   - Uses `scripts/deploy/policy.mjs` to classify changed files.
   - If changes are strictly website-only (e.g. `apps/website/`, `docs/deployment/`), resolves the latest verified published release and invokes `deploy-website.yml`.
   - If changes include core or shared packages, promotion is skipped and deferred to the formal release workflow.

3. **`release.yml` (Release Promotion)**:
   - Upon successful npm publication of `@agent-interaction-kit/core` and GitHub release creation, verifies `publication.json` on the npm registry and triggers `deploy-website.yml`.

## Production origin and hostnames

- **Canonical Origin**: `SITE_URL` repository variable is set to `https://agent-interaction-kit.vercel.app`.
- Preview and local builds emit `noindex` and disallow crawling; no fake canonical is generated.
- Custom domain purchases (e.g. `agentinteractionkit.dev`) are deferred to future operational milestones.

Never commit credentials, `.env`, or `.vercel`. Production credentials (`VERCEL_TOKEN`) are restricted to the `vercel-production` environment and only accessible on `main`.

## Scheduled health monitoring (`docs-health.yml`)

The continuous health of the published documentation and live website is monitored by `.github/workflows/docs-health.yml`:

- **Triggers**:
  - Scheduled: Weekly on Mondays at 09:00 UTC (`cron: '0 9 * * 1'`).
  - Manual: `workflow_dispatch` for on-demand verification.
- **Security**: Strictly read-only permissions (`contents: read`).
- **Health Verification**:
  1. Queries live `/version.json` from the production site (`${{ vars.SITE_URL }}` or `https://agent-interaction-kit.vercel.app`).
  2. Parses published `version` and `siteSha`.
  3. Executes `node scripts/docs/verify-published.mjs "$TARGET_URL" --expected-version "$VERSION" --expected-site-sha "$SHA"`, which downloads the public example manifests and runs consumer onboarding commands in an isolated environment against the live published npm package.
  4. Executes Playwright browser tests against the live site (`SITE_TEST_URL="$TARGET_URL" pnpm test:web`).
  5. Any failure exits non-zero, triggering standard GitHub notification mechanisms to maintainers without cluttering the issue tracker.

## Packaging

Build with `pnpm build:core`, then `pnpm --filter @agent-interaction-kit/core pack --pack-destination <directory>`. Inspect the tarball before release: no website, fixtures, or tests are included. Only `@agent-interaction-kit/core` is published to npm.
