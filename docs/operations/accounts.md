# Accounts and bot identity inventory

This document defines the registry accounts, bot identity, environments, configuration variables, and secrets required to operate and automate releases and deployments for `agent-interaction-kit`.

## Zero secrets policy

- **No secrets in git**: Under no circumstances may private keys, API tokens, passwords, or credentials be committed to the repository, added to issue templates, included in chat conversations, or stored in artifacts.
- **Direct injection**: All secrets are stored exclusively in GitHub Secrets (at repository or environment level) and injected into GitHub Actions workflows via the `secrets` context.
- **Fork isolation**: PRs from forks do not have access to repository or environment secrets. CI workflows for PRs operate in read-only mode with minimum required permissions.
- **Auditing**: If a secret or private key is ever exposed or suspected to be compromised, it must be revoked immediately at the provider and rotated.

---

## Registries and accounts inventory

| Provider | Resource / Account | Target Identifier | Access Model | Purpose |
| --- | --- | --- | --- | --- |
| **npm** | Scope / Organization | `@agent-interaction-kit` | Maintainer account + GitHub OIDC | Publishes `@agent-interaction-kit/core`. Root and website workspaces remain private. |
| **GitHub** | Repository | `DevJoaoLopes/agent-interaction-kit` | Repository Admin (`DevJoaoLopes`) | Source repository, CI/CD runners, rulesets, and environments. |
| **GitHub** | GitHub App (Bot) | `AIK Release Bot` | Installed on repository only | Automates `release-please` PRs, releases, changelog generation, and tag creation. |
| **Vercel** | Project / Team | `agent-interaction-kit` | Maintainer account + Vercel Token | Hosts documentation and website (`apps/website`) with preview and production deploys. |

### Current account status

- **npm**: Currently unauthenticated (`npm whoami` returned `ENEEDAUTH`). The scope `@agent-interaction-kit` is not yet claimed (`404 Scope not found`). The package must not be renamed silently if the scope cannot be obtained; maintainer action is required.
- **GitHub App**: Pending creation by maintainer under Developer settings.
- **Vercel**: Pending project registration and hostname attribution under maintainer account.

---

## Configuration variables and secrets inventory

The following exact configuration variables and secrets inventory governs automated releases and deployments:

```text
RELEASE_APP_ID: repository Actions variable
RELEASE_APP_PRIVATE_KEY: repository Actions secret
NPM_PUBLISH_ENABLED: repository Actions variable, initially false
VERCEL_ORG_ID: repository Actions variable
VERCEL_PROJECT_ID: repository Actions variable
VERCEL_TOKEN: secret in environment vercel-production
SITE_URL: repository Actions variable after hostname assignment
NPM_TOKEN: not required for recurring publication
```

### Detailed inventory

| Name | Type | Scope | Current Status | Description & Usage |
| --- | --- | --- | --- | --- |
| `RELEASE_APP_ID` | Actions Variable | Repository | Pending App creation | Numeric App ID of `AIK Release Bot`. Used by Actions to generate short-lived installation tokens for `release-please`. |
| `RELEASE_APP_PRIVATE_KEY` | Actions Secret | Repository | Pending App creation | PEM private key of `AIK Release Bot`. Stored directly in GitHub Secrets; never committed or logged. |
| `NPM_PUBLISH_ENABLED` | Actions Variable | Repository | Initialized (`false`) | Guard variable gating automated npm publishing. Initialized to `false` via `gh variable set`. Enabled after bootstrap. |
| `VERCEL_ORG_ID` | Actions Variable | Repository | Pending Vercel project | Vercel team/account ID, found in Vercel project settings. Required by Vercel CLI deployments. |
| `VERCEL_PROJECT_ID` | Actions Variable | Repository | Pending Vercel project | Vercel project ID for `agent-interaction-kit`. Required by Vercel CLI deployments. |
| `VERCEL_TOKEN` | Actions Secret | Environment (`vercel-production`) | Pending Vercel project | Access token created in Vercel account settings with deploy scope. Isolated in `vercel-production`. |
| `SITE_URL` | Actions Variable | Repository | Pending hostname assignment | Canonical HTTPS production origin (e.g., `https://agent-interaction-kit.vercel.app`). Set after hostname confirmation. |
| `NPM_TOKEN` | *None* | *None* | Not required | **Not required for recurring publication**. Recurring publishes use GitHub OIDC Trusted Publishing (`id-token: write`). |

---

## Roles, responsibilities, and settings links

### Settings quick links

- **GitHub Repository Settings**: [`https://github.com/DevJoaoLopes/agent-interaction-kit/settings`](https://github.com/DevJoaoLopes/agent-interaction-kit/settings)
- **Repository Actions Variables**: [`https://github.com/DevJoaoLopes/agent-interaction-kit/settings/variables/actions`](https://github.com/DevJoaoLopes/agent-interaction-kit/settings/variables/actions)
- **Repository Actions Secrets**: [`https://github.com/DevJoaoLopes/agent-interaction-kit/settings/secrets/actions`](https://github.com/DevJoaoLopes/agent-interaction-kit/settings/secrets/actions)
- **Repository Environments**: [`https://github.com/DevJoaoLopes/agent-interaction-kit/settings/environments`](https://github.com/DevJoaoLopes/agent-interaction-kit/settings/environments)
- **GitHub Developer Settings (Create App)**: [`https://github.com/settings/apps/new`](https://github.com/settings/apps/new)
- **GitHub App Installations**: [`https://github.com/DevJoaoLopes/agent-interaction-kit/settings/installations`](https://github.com/DevJoaoLopes/agent-interaction-kit/settings/installations)
- **npm Organization / Scope**: [`https://www.npmjs.com/org/create`](https://www.npmjs.com/org/create)
- **Vercel Dashboard**: [`https://vercel.com/dashboard`](https://vercel.com/dashboard)

### Roles and responsibilities

- **Maintainer (`DevJoaoLopes`)**:
  - Full administrative ownership of the GitHub repository, npm organization, and Vercel project.
  - Generates initial bootstrap publication (`1.0.0-beta.1`) via authenticated maintainer session.
  - Enters credentials and secrets into GitHub settings.
  - Reviews and merges PRs (including bot release PRs); triggers production promotions.
- **Bot Identity (`AIK Release Bot`)**:
  - GitHub App scoped specifically to automate releases.
  - Generates and updates Release PRs with version bumps and changelogs (`release-please`).
  - Creates Git tags (`v*`) and GitHub Releases upon merge of a release PR.
  - Operates under strict least-privilege: cannot bypass branch rules, cannot modify workflows, cannot administer repository.
- **Automated CI/CD Workflows**:
  - Validates PRs (commitlint, build, unit tests, end-to-end tests, bundle smoke).
  - Publishes `@agent-interaction-kit/core` to npm via OIDC Trusted Publishing upon release tag.
  - Deploys website to Vercel upon release or documentation changes to `main`.

---

## Environments and branch policies

The repository defines two GitHub deployment environments with restricted deployment branch policies:

### 1. `npm` Environment

- **Environment Name**: `npm`
- **Environment ID**: `21815059773`
- **Settings Link**: [`https://github.com/DevJoaoLopes/agent-interaction-kit/settings/environments/21815059773/edit`](https://github.com/DevJoaoLopes/agent-interaction-kit/settings/environments/21815059773/edit)
- **Deployment Branch Policy**: Restricted to `main` (`refs/heads/main`).
- **Required Reviewers**: None (designed for a solo maintainer; no blocking second approver).
- **Function**: Serves as the security identity boundary for npm OIDC Trusted Publishing. Workflows requesting `id-token: write` reference this environment.
- **Execution Rules**: Manual publish workflows must be dispatched on `main` and validate tags in code. HEAD arbitrary commits cannot trigger publish.

### 2. `vercel-production` Environment

- **Environment Name**: `vercel-production`
- **Environment ID**: `21815061149`
- **Settings Link**: [`https://github.com/DevJoaoLopes/agent-interaction-kit/settings/environments/21815061149/edit`](https://github.com/DevJoaoLopes/agent-interaction-kit/settings/environments/21815061149/edit)
- **Deployment Branch Policy**: Restricted to `main` (`refs/heads/main`).
- **Required Reviewers**: None.
- **Secrets Hosted**: `VERCEL_TOKEN` (production deployment credential).
- **Function**: Isolates the production deployment token from preview builds, branch workflows, and PRs.
- **Execution Rules**: Only production promotions on `main` following verified package smoke tests can access this environment.

---

## Step-by-step checklist for maintainer setup

### Step 1: npm scope and package bootstrap

1. **Verify session**:
   ```bash
   npm whoami --registry=https://registry.npmjs.org
   ```
   If not logged in, execute `npm login --registry=https://registry.npmjs.org` (or `npm adduser`).
2. **Check scope**:
   ```bash
   npm org ls agent-interaction-kit --json
   ```
   If the scope does not exist, create the free public organization `agent-interaction-kit` at [`https://www.npmjs.com/org/create`](https://www.npmjs.com/org/create).
   *Note: If the scope name is unavailable, do not silently rename the package in code; coordinate scope selection with the maintainer.*
3. **Bootstrap first release (`1.0.0-beta.1`)**:
   - npm requires that a package exists before configuring Trusted Publishers.
   - Set or verify package version to `1.0.0-beta.1` (managed systematically in Plan 2):
     ```bash
     pnpm --filter @agent-interaction-kit/core version 1.0.0-beta.1 --no-git-tag-version
     ```
   - Build and test the core package locally:
     ```bash
     pnpm --filter @agent-interaction-kit/core build
     pnpm --filter @agent-interaction-kit/core test
     ```
   - Publish the initial `1.0.0-beta.1` release with dist-tag `next` using maintainer session:
     ```bash
     pnpm --filter @agent-interaction-kit/core publish --access public --tag next
     ```
4. **Configure npm Trusted Publisher**:
   - Go to `https://www.npmjs.com/package/@agent-interaction-kit/core/access`.
   - Under **Trusted Publishers**, click **Add Trusted Publisher** -> **GitHub Actions**.
   - Set Owner: `DevJoaoLopes`
   - Set Repository: `agent-interaction-kit`
   - Set Workflow filename: `release.yml`
   - Set Environment: `npm`
5. **Enable automated publishing**:
   ```bash
   gh variable set NPM_PUBLISH_ENABLED --body "true" --repo DevJoaoLopes/agent-interaction-kit
   ```

### Step 2: GitHub App creation (`AIK Release Bot`)

1. **Navigate to App creation**:
   Open [`https://github.com/settings/apps/new`](https://github.com/settings/apps/new).
2. **Fill basic information**:
   - **GitHub App name**: `AIK Release Bot` (if taken, use `aik-release-bot-oss`).
   - **Homepage URL**: `https://github.com/DevJoaoLopes/agent-interaction-kit`
   - **Webhook**: Uncheck **Active** (no webhook needed for release-please).
3. **Set permissions (Least Privilege)**:
   - **Repository permissions**:
     - `Contents`: **Read and write** (to create tags, commit version bumps, and generate releases)
     - `Pull requests`: **Read and write** (to open and update release-please PRs)
     - `Issues`: **Read and write** (to label, link, and close release issues)
     - `Metadata`: **Read-only** (mandatory / implicit)
   - **All other permissions**: Set to **No access**.
   - *Crucial*: Do **not** grant `Administration`, `Secrets`, `Workflows` (write), or any bypass of rulesets/branch protection.
4. **Select installation target**:
   - Under "Where can this GitHub App be installed?", choose **Only on this account**.
5. **Create App and generate private key**:
   - Click **Create GitHub App**.
   - Note the **App ID** displayed on the general page.
   - Scroll down to **Private keys** and click **Generate a private key**.
   - A `.pem` file will be downloaded to your local machine.
6. **Install App on repository**:
   - In the left sidebar of the App settings, click **Install App**.
   - Choose your account (`DevJoaoLopes`).
   - Select **Only select repositories** -> choose `DevJoaoLopes/agent-interaction-kit`.
   - Click **Install**.
7. **Register credentials in GitHub Actions**:
   - Set the App ID variable:
     ```bash
     gh variable set RELEASE_APP_ID --body "<APP_ID>" --repo DevJoaoLopes/agent-interaction-kit
     ```
   - Set the private key secret (paste the full contents of the downloaded PEM file):
     ```bash
     gh secret set RELEASE_APP_PRIVATE_KEY --repo DevJoaoLopes/agent-interaction-kit < /path/to/private-key.pem
     ```
   - Securely delete or archive the local `.pem` file. Never commit it to git.

### Step 3: Vercel project registration and configuration

1. **Import repository into Vercel**:
   - Log into Vercel dashboard at [`https://vercel.com/dashboard`](https://vercel.com/dashboard).
   - Click **Add New...** -> **Project**.
   - Import `DevJoaoLopes/agent-interaction-kit`.
2. **Configure project settings**:
   - **Project Name**: `agent-interaction-kit`
   - **Framework Preset**: `Astro`
   - **Root Directory**: `apps/website` (confirm workspace inclusion is permitted)
   - **Node.js Version**: `24.x`
   - **Build Command**: `pnpm build` (website build script, which builds core first)
   - **Output Directory**: `dist`
   - **Production Branch**: `main`
3. **Verify hostname attribution**:
   - Confirm in Vercel dashboard / authenticated API that the target hostname `agent-interaction-kit.vercel.app` is assigned.
   - *Note: A 404 response on the web does not prove hostname availability. Availability must be confirmed via the authenticated Vercel dashboard.*
   - If the project name or hostname is unavailable, ask the maintainer for an alternative name before proceeding. Do not purchase custom domains.
4. **Collect identifiers and generate token**:
   - In Project Settings -> General, record **Project ID** and **Team ID** / **Organization ID**.
   - In Account Settings -> Tokens, generate a personal/team access token named `aik-vercel-deploy`.
5. **Configure GitHub Actions variables and secret**:
   ```bash
   gh variable set VERCEL_ORG_ID --body "<VERCEL_ORG_ID>" --repo DevJoaoLopes/agent-interaction-kit
   gh variable set VERCEL_PROJECT_ID --body "<VERCEL_PROJECT_ID>" --repo DevJoaoLopes/agent-interaction-kit
   gh variable set SITE_URL --body "https://agent-interaction-kit.vercel.app" --repo DevJoaoLopes/agent-interaction-kit
   # Note: gh secret set will prompt interactively for the secret value in the terminal to avoid leaking it in shell history:
   gh secret set VERCEL_TOKEN --env vercel-production --repo DevJoaoLopes/agent-interaction-kit
   ```
6. **Preview vs Production setup**:
   - Previews are automatically built by the Vercel Git integration on PR branches (without production secrets).
   - Production deployments are triggered by GitHub Actions on `main` following verified package smoke tests.
