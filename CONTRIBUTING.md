# Contributing to Agent Interaction Kit

Thank you for your interest in contributing to **Agent Interaction Kit (AIK)**! We welcome contributions from everyone—whether you are reporting an issue, improving documentation, submitting a bug fix, or proposing a new contract evaluation feature.

Please read through this guide to understand our repository structure, development workflow, and conventions.

---

## Workspace Structure

Agent Interaction Kit is organized as a monorepo managed with `pnpm` workspaces:

- **[`packages/core`](packages/core)**: The core library and CLI (`@agent-interaction-kit/core`). Contains the Consumer-Driven Contract (CDC) engine, schema compatibility checker, manifest parsers, report formatters, and the `aik` executable.
- **[`apps/website`](apps/website)**: The public showcase and documentation website built with Astro and Tailwind CSS.

---

## Prerequisites

- **Node.js**: `v24` (or latest LTS). The `@agent-interaction-kit/core` runtime targets Node.js `>= 20`, but workspace tooling runs on Node 24.
- **pnpm**: `v10` (matching the version configured in GitHub Actions workflows).

---

## Development Setup & Baseline Commands

Clone the repository and install dependencies:

```bash
git clone https://github.com/DevJoaoLopes/agent-interaction-kit.git
cd agent-interaction-kit
pnpm install --frozen-lockfile
```

### Verification Commands

Before submitting changes, ensure the repository verification commands run cleanly:

| Command | Purpose |
| :--- | :--- |
| `pnpm check` | Runs Biome linting/formatting checks and website Astro/Prettier checks |
| `pnpm knip` | Detects unused files, unused dependencies, and unexported code |
| `pnpm typecheck` | Validates TypeScript types across both `packages/core` and `apps/website` |
| `pnpm test` | Runs unit, schema, and CLI end-to-end tests for `packages/core` using Vitest |
| `pnpm build` | Compiles `packages/core` (via `tsup`) and builds `apps/website` (via Astro) |
| `pnpm test:web` | Runs Playwright integration and accessibility tests for `apps/website` |

> [!NOTE]
> If running `pnpm test:web` for the first time, install the Chromium browser binary:
> ```bash
> pnpm --filter @agent-interaction-kit/website exec playwright install chromium
> ```

---

## Commit & Pull Request Workflow

### Conventional Commits

We follow the [Conventional Commits](https://www.conventionalcommits.org/) specification. Pull Request titles are validated in CI against Conventional Commit rules.

Because PRs are merged to `main` using **Squash and Merge**, the **Pull Request title** becomes the commit subject on `main`. Intermediate commits within your feature branch do not need to follow strict commit conventions, but your PR title must.

#### Standard Scopes

Common scopes used in this repository:
- `core`: Changes to `@agent-interaction-kit/core` (library, engine, reporters, CLI).
- `website`: Changes to `apps/website` (landing page, docs, styles).
- `deps`: Dependency and lockfile updates.

#### Examples

```text
fix(core): reject incompatible result types
feat(core): add a report format
feat(core)!: change manifest schema
docs(website): clarify setup instructions
```

---

## Release & Governance Policies

To keep our releases predictable and reliable:

1. **Website-only changes do not publish npm packages**: Changes scoped solely to `apps/website` or website documentation deploy to the website and do not trigger a release of `@agent-interaction-kit/core` to npm.
2. **Dependency and lockfile changes**: Any dependency or `pnpm-lock.yaml` modification affecting `packages/core` must be evaluated for release impact and appropriate semver version bump.
3. **Bot release branches**: Automated release branches created by release automation must not receive manual product edits. If product fixes are needed, merge them into `main` first via regular PR.
4. **Maintainer review**: The maintainer reviews version bumps, generated changelogs, and release PRs before merging to publish.

---

## Submitting a Pull Request

1. Fork the repository and create a branch from `main`.
2. Keep your changes focused and atomic.
3. Verify all baseline checks pass locally:
   ```bash
   pnpm check
   pnpm knip
   pnpm typecheck
   pnpm test
   pnpm build
   pnpm test:web
   ```
4. If you modified consumer-facing workflows or onboarding instructions, verify them from a clean installation.
5. Ensure no secrets, sensitive credentials, or internal application data are committed.
6. Open a Pull Request on GitHub. The PR template includes a brief checklist to verify these requirements.

We aim to keep review turnaround swift and do not require heavy contribution bureaucracy for small fixes or improvements.

---

## Code of Conduct & Security

- For our community guidelines, see [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md).
- To report a security vulnerability, please follow the process in [SECURITY.md](SECURITY.md). Do not report security vulnerabilities in public issues.
