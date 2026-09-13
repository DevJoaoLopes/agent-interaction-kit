# Website Operations and Vercel Configuration Guide

This document defines the operational procedures, project configuration, security boundaries, deployment gates, and environment inventory for hosting the `agent-interaction-kit` documentation website (`apps/website`) on Vercel.

---

## 1. Overview and Architecture

The documentation website for `agent-interaction-kit` is located in `apps/website`. It is built with Astro and React as a fully static site (`output: "static"`). During its build process (`pnpm build`), it compiles the core package (`@agent-interaction-kit/core`) and validates the live documentation examples against the compiled AIK binary before generating production HTML/assets in `dist`.

Deployments are divided into two distinct operational flows:

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│                          Pull Request Workflow                              │
│                                                                             │
│  PR branch pushed ──► Vercel Git Integration ──► Preview Deployment URL     │
│                       (Automatic preview)        (noindex, zero secrets)    │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│                        Production Promotion Workflow                        │
│                                                                             │
│  Commit on main   ──► GitHub Actions Gate    ──► CLI Deploy & Promote       │
│  (Tag or Site PR)     (CI & Publication Check)   (agent-interaction-kit     │
│                                                   .vercel.app)              │
└─────────────────────────────────────────────────────────────────────────────┘
```

1. **Pull Request Previews**: Managed automatically by the Vercel Git Integration. Every pull request receives an isolated preview URL for visual review and accessibility testing.
2. **Production Promotions**: Controlled strictly through a reusable GitHub Actions workflow (`deploy-website.yml`). Git auto-deployment on `main` is disabled at the project configuration level via `apps/website/vercel.json`. Production is only promoted after end-to-end package verification (`publication.json` on npm) or verified website-only CI matrix success.

---

## 2. Desired Hostname and Project Attribution

### 2.1 Target Hostname

- **Desired Hostname**: `agent-interaction-kit.vercel.app`
- **Canonical Production Origin**: `https://agent-interaction-kit.vercel.app`

### 2.2 Hostname Availability Verification

> [!IMPORTANT]
> **A HTTP 404 status code is NOT proof of hostname availability or reservation.**
> An unassigned subdomain on `*.vercel.app` returns `404 Not Found`, but so does a domain claimed by an inactive project or reserved by an existing account. Hostname availability must be confirmed directly through the authenticated Vercel dashboard or authenticated Vercel CLI during project creation.

### 2.3 Collision Fallback Runbook

If `agent-interaction-kit.vercel.app` is already claimed or reserved by another Vercel account:
1. Do **not** proceed with automated promotion.
2. Pause the setup task and notify the maintainer (`DevJoaoLopes`) to select an alternative prefix (for example, `aik-docs.vercel.app` or `agent-interaction-kit-docs.vercel.app`).
3. Update `SITE_URL` in GitHub Actions repository variables once the alternative hostname is claimed and confirmed.
4. **Scope boundary**: Purchasing or configuring custom domains (such as `agentinteractionkit.dev`) is explicitly out of scope for current milestones.

---

## 3. Vercel Project Configuration

When importing or configuring the project in the Vercel Dashboard:

| Configuration Field | Required Value | Rationale |
| --- | --- | --- |
| **Project Name** | `agent-interaction-kit` | Matches repository and scope name. |
| **Framework Preset** | `Astro` | Configures Vercel's Astro build optimizations. |
| **Root Directory** | `apps/website` | Isolates the website workspace inside the monorepo. |
| **Include files outside Root Directory** | **Enabled / Checked** | **Mandatory**. The website depends on `packages/core` via `workspace:*` and uses the root `pnpm-lock.yaml`. |
| **Node.js Version** | `24.x` | Aligns with the modern Node runtime required by Astro 5+ and the website workspace. |
| **Install Command** | `pnpm install --frozen-lockfile` | Ensures deterministic workspace installation using the root lockfile. |
| **Build Command** | `pnpm build` | Triggers `prebuild` (which compiles `@agent-interaction-kit/core` and validates example manifests) before `astro build`. |
| **Output Directory** | `dist` | Astro's default static build output directory. |
| **Production Branch** | `main` | Defines the branch designated for production promotions. |

---

## 4. Security and Deployment Protection

### 4.1 Git Auto-Deployment Configuration (`vercel.json`)

To prevent Vercel from automatically promoting commits on `main` before package publication and smoke testing have completed, `apps/website/vercel.json` explicitly disables git deployments for `main`:

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

> [!CAUTION]
> **Never specify `"*": true` in `git.deploymentEnabled`.**
> Adding a wildcard `"*": true` rule would match `main` and inadvertently re-enable automatic deployments on merge, bypassing the GitHub Actions release gate and causing race conditions with npm package publication.

### 4.2 Separation of Concerns: Previews vs. Production

1. **Pull Request Previews**:
   - Built and deployed by the Vercel GitHub integration.
   - Emits `noindex` and `X-Robots-Tag: noindex, nofollow` to prevent search engine indexing of ephemeral builds.
   - Operates with zero secrets: no access to `VERCEL_TOKEN`, npm tokens, or bot keys.
2. **Production Promotions**:
   - Promoted only by GitHub Actions using `pnpm exec vercel promote "$DEPLOYMENT_URL" --yes --token "$VERCEL_TOKEN"`.
   - Requires explicit inputs: verified Git SHA, release tag, and package version confirmed on the npm registry.
   - Concurrency group `aik-site-production` prevents overlapping deployments.

---

## 5. GitHub Environment and Secrets Inventory

Production deployment credentials are strictly isolated within a dedicated GitHub deployment environment:

### 5.1 Environment Definition

- **Environment Name**: `vercel-production`
- **Deployment Branch Policy**: Restricted to `refs/heads/main` (`Selected branches` -> `main`).
- **Required Reviewers**: None (optimized for solo maintainer workflow).

### 5.2 Environment Secrets and Variables

| Identifier | Type | Scope | Description |
| --- | --- | --- | --- |
| `VERCEL_TOKEN` | Actions Secret | Environment (`vercel-production`) | Personal access token with project deploy permissions, used by the deploy workflow. |
| `VERCEL_ORG_ID` | Actions Variable | Repository | Vercel team ID or user account ID (found in Project Settings -> General). |
| `VERCEL_PROJECT_ID` | Actions Variable | Repository | Vercel project unique identifier (found in Project Settings -> General). |
| `SITE_URL` | Actions Variable | Repository | Canonical HTTPS production origin: `https://agent-interaction-kit.vercel.app`. |

### 5.3 CLI Setup Commands for Maintainer

```bash
# Set repository-level configuration variables
gh variable set VERCEL_ORG_ID --body "<VERCEL_ORG_ID>" --repo DevJoaoLopes/agent-interaction-kit
gh variable set VERCEL_PROJECT_ID --body "<VERCEL_PROJECT_ID>" --repo DevJoaoLopes/agent-interaction-kit
gh variable set SITE_URL --body "https://agent-interaction-kit.vercel.app" --repo DevJoaoLopes/agent-interaction-kit

# Set environment-scoped secret (prompts interactively to avoid shell history logging)
gh secret set VERCEL_TOKEN --env vercel-production --repo DevJoaoLopes/agent-interaction-kit
```

---

## 6. Zero-Secrets Policy and Environment Isolation

- **No Secrets in Vercel Dashboard**: The Vercel project does not need and must not be configured with repository write credentials, npm publishing tokens (`NPM_TOKEN`), GitHub App private keys (`RELEASE_APP_PRIVATE_KEY`), or Agamenon validation tokens.
- **Static Artifacts**: The website contains no server-side runtime (`output: "static"`). All HTML, CSS, JavaScript, and example manifests are static files served from Vercel's global Edge CDN. No secrets exist in the generated client bundle.
- **Build Metadata Isolation**: Public variables passed during build (`PUBLIC_AIK_VERSION`, `PUBLIC_AIK_RELEASE_TAG`, `PUBLIC_SITE_SHA`, `SITE_URL`) contain non-sensitive release metadata and are not secrets.
- **Token Least Privilege**: The `VERCEL_TOKEN` is only accessible to workflows running on `main` that have satisfied upstream CI and package smoke tests. PRs from branches or forks cannot access `vercel-production`.

---

## 7. Plan Limits and Operating Boundaries

### 7.1 Vercel Plan Suitability

The `agent-interaction-kit` project operates under Vercel's **Hobby (Personal)** plan for non-commercial open-source usage:

- **Bandwidth**: 100 GB / month (more than sufficient for static documentation and example JSON files).
- **Build Execution**: 100 build execution hours / month.
- **Max Build Duration**: 45 minutes per build (website build executes in under 1 minute).
- **Team Size**: 1 member (solo maintainer account `DevJoaoLopes`).

### 7.2 Explicit Exclusions

- **Custom Domain Purchases**: Purchasing a domain name (such as `.dev` or `.com`) is out of scope for the current milestones. All production URLs target the official `agent-interaction-kit.vercel.app` subdomain.
- **Serverless / SSR Functions**: No dynamic backend API or Serverless Functions are deployed. If dynamic API functionality is needed in the future, architectural review and resource sizing must be conducted first.

---

## 8. Operator Setup Checklist

1. [ ] **Verify Hostname**: Log into Vercel dashboard and verify `agent-interaction-kit.vercel.app` is available and assigned to the project.
2. [ ] **Link Repository**: Import `DevJoaoLopes/agent-interaction-kit` with root directory `apps/website` and workspace inclusion enabled.
3. [ ] **Verify Node & Commands**: Set Node `24.x`, build `pnpm build`, output `dist`.
4. [ ] **Verify `vercel.json`**: Confirm that automatic deployment on `main` is disabled via `apps/website/vercel.json`.
5. [ ] **Configure GitHub Environment**: Create `vercel-production` environment in GitHub repository settings with branch restriction `main`.
6. [ ] **Populate Variables & Secrets**: Set `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`, `SITE_URL` in repository variables; set `VERCEL_TOKEN` in `vercel-production` environment secrets.
7. [ ] **Verify Pull Request Previews**: Open a test PR to confirm Vercel preview deployment builds successfully without production promotion.
