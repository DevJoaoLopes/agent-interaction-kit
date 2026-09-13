# Repository Governance and Branch Protection Guide

This document defines the repository governance architecture, branch protection rulesets, merge policies, status check integrations, and administrative recovery runbooks for `agent-interaction-kit`.

---

## 1. Governance Architecture Overview

The repository governance model is designed for open-source sustainability under a solo maintainer (`DevJoaoLopes`) with automated bot operations (`AIK Release Bot`). It establishes immutable quality gates without introducing bottlenecks that would block solo development or automated releases:

- **Zero-Bypass Architecture**: Neither the maintainer nor automated bots have bypass permissions (`bypass_actors: []`). All changes destined for `main` must pass through the pull request workflow and satisfy all CI gates.
- **Linear Squash History**: Merge commits and rebase merges are disabled. Every PR is merged via squash merge, converting the PR into a single atomic commit with Conventional Commits semantics on `main`.
- **Cryptographic Integration Binding**: Required status checks explicitly bind to the GitHub Actions App (`integration_id: 15368`), preventing third-party or untrusted apps from spoofing required checks.
- **Solo Maintainer PR Workflow**: Pull request protection requires 0 approving reviews (`required_approving_review_count: 0`), allowing the maintainer to author, inspect, and merge their own pull requests while ensuring all automated gates and conversation thread resolutions remain strictly enforced.
- **Protected Release Tags**: Tags matching `refs/tags/v*` cannot be deleted or force-pushed, preserving release immutability and npm provenance integrity.

---

## 2. Active Rulesets Inventory

Repository protection is configured via GitHub Repository Rulesets.

### Summary Table

| Ruleset Name | Ruleset ID | Target | Enforcement | Key Protections | Bypass Actors |
| --- | --- | --- | --- | --- | --- |
| `main-protection` | `23119836` | Branch (`refs/heads/main`) | `active` | No deletion, no force push, linear history, PR required, review threads resolved, required status checks (`CI required`, `PR title`) | None (`[]`) |
| `release-tags-protection` | `23119843` | Tag (`refs/tags/v*`) | `active` | No deletion, no force push (creation allowed for release automation) | None (`[]`) |

### Ruleset Links

- **Rulesets Dashboard**: [`https://github.com/DevJoaoLopes/agent-interaction-kit/settings/rules`](https://github.com/DevJoaoLopes/agent-interaction-kit/settings/rules)
- **`main-protection` Ruleset**: [`https://github.com/DevJoaoLopes/agent-interaction-kit/rules/23119836`](https://github.com/DevJoaoLopes/agent-interaction-kit/rules/23119836)
- **`release-tags-protection` Ruleset**: [`https://github.com/DevJoaoLopes/agent-interaction-kit/rules/23119843`](https://github.com/DevJoaoLopes/agent-interaction-kit/rules/23119843)

---

## 3. Ruleset Specifications

### 3.1 `main-protection` (ID: `23119836`)

Defined in [`.github/rulesets/main.json`](../../.github/rulesets/main.json):

```json
{
  "name": "main-protection",
  "target": "branch",
  "enforcement": "active",
  "bypass_actors": [],
  "conditions": {
    "ref_name": {
      "include": ["refs/heads/main"],
      "exclude": []
    }
  },
  "rules": [
    {
      "type": "deletion"
    },
    {
      "type": "non_fast_forward"
    },
    {
      "type": "required_linear_history"
    },
    {
      "type": "pull_request",
      "parameters": {
        "required_approving_review_count": 0,
        "dismiss_stale_reviews_on_push": false,
        "require_code_owner_review": false,
        "require_last_push_approval": false,
        "required_review_thread_resolution": true
      }
    },
    {
      "type": "required_status_checks",
      "parameters": {
        "strict_required_status_checks_policy": true,
        "do_not_enforce_on_create": false,
        "required_status_checks": [
          {
            "context": "CI required",
            "integration_id": 15368
          },
          {
            "context": "PR title",
            "integration_id": 15368
          }
        ]
      }
    }
  ]
}
```

#### Enforced Rules Detail:

1. **`deletion`**: Prohibits deletion of the `main` branch.
2. **`non_fast_forward`**: Prohibits force pushes (`git push --force`) to `main`.
3. **`required_linear_history`**: Prevents merge commits from entering the branch, guaranteeing a linear Git history.
4. **`pull_request`**:
   - Direct pushes to `main` are blocked; all changes must arrive via a Pull Request.
   - `required_approving_review_count: 0`: Enables solo maintainer self-merges without requiring a second account.
   - `required_review_thread_resolution: true`: All review comment threads must be marked resolved before merging.
5. **`required_status_checks`**:
   - `strict_required_status_checks_policy: true`: Branch must be up-to-date with `main` before merging (strict branch protection).
   - `do_not_enforce_on_create: false`: Protection applies immediately upon branch creation.
   - Required status checks:
     - `CI required` (`integration_id: 15368`)
     - `PR title` (`integration_id: 15368`)

---

### 3.2 `release-tags-protection` (ID: `23119843`)

Defined in [`.github/rulesets/release-tags.json`](../../.github/rulesets/release-tags.json):

```json
{
  "name": "release-tags-protection",
  "target": "tag",
  "enforcement": "active",
  "bypass_actors": [],
  "conditions": {
    "ref_name": {
      "include": ["refs/tags/v*"],
      "exclude": []
    }
  },
  "rules": [
    {
      "type": "deletion"
    },
    {
      "type": "non_fast_forward"
    }
  ]
}
```

#### Enforced Rules Detail:

1. **Target**: Applies to all tags matching the pattern `refs/tags/v*` (e.g., `v1.0.0`, `v1.0.0-beta.1`).
2. **`deletion`**: Prohibits deleting release tags once pushed.
3. **`non_fast_forward`**: Prohibits moving, overwriting, or force-updating existing release tags.
4. **No `creation` rule**: Tag creation is deliberately unconstrained by ruleset creation blockers so that the automated release workflow (`AIK Release Bot` or maintainer) can push new tags upon release PR merges.

---

## 4. Repository Merge Methods and Settings

The repository configuration enforces squash merging exclusively, synchronizing PR metadata with Conventional Commits requirements.

```bash
gh api repos/DevJoaoLopes/agent-interaction-kit \
  --jq '{allow_merge_commit, allow_rebase_merge, allow_squash_merge, squash_merge_commit_title, squash_merge_commit_message, allow_auto_merge, delete_branch_on_merge}'
```

Output:
```json
{
  "allow_auto_merge": false,
  "allow_merge_commit": false,
  "allow_rebase_merge": false,
  "allow_squash_merge": true,
  "delete_branch_on_merge": true,
  "squash_merge_commit_message": "PR_BODY",
  "squash_merge_commit_title": "PR_TITLE"
}
```

### Policy Rationale:

- **`allow_squash_merge: true`**: All pull requests collapse into a single commit upon landing on `main`.
- **`allow_merge_commit: false` & `allow_rebase_merge: false`**: Disables alternative merge strategies to avoid non-linear git graphs and multi-commit PR pollution.
- **`squash_merge_commit_title: "PR_TITLE"`**: Uses the PR title as the squash commit headline. Because `PR title` check validates the PR title against Conventional Commits (`type(scope): subject`), the squashed commit on `main` is automatically formatted correctly for changelog generation tools (`release-please`).
- **`squash_merge_commit_message: "PR_BODY"`**: Pulls the PR description and verification checklist into the commit message body.
- **`allow_auto_merge: false`**: Auto-merge is disabled to ensure every release and feature merge is intentionally reviewed and triggered by the maintainer.
- **`delete_branch_on_merge: true`**: Automatically deletes feature branches on GitHub after successful merge, keeping the branch list clean.

---

## 5. Required Status Checks & App Identity

The CI pipeline runs via GitHub Actions. All status checks enforce quality gates prior to merge.

| Check Name | Originating Workflow | GitHub App ID | Description |
| --- | --- | --- | --- |
| `CI required` | `.github/workflows/ci.yml` (`required` job) | `15368` (GitHub Actions) | Aggregation gate evaluating `lint` (Biome + Knip), `core-matrix` (Node 20, 22, 24 on Linux and macOS), and `website` (build + Playwright e2e). Fails if any job fails or is cancelled. |
| `PR title` | `.github/workflows/commitlint.yml` (`commitlint` job) | `15368` (GitHub Actions) | Validates PR title against Conventional Commits (`@commitlint/config-conventional`). |

### Why `integration_id: 15368` is Critical:

GitHub rulesets allow binding a required status check to an `integration_id` (GitHub App ID). By setting `integration_id: 15368` (the official GitHub Actions App), status checks cannot be passed or spoofed by commit status API calls from unauthorized tokens or external webhooks.

### Fork Safety:

Workflows execute on `pull_request` triggers using read-only tokens (`contents: read`, `pull-requests: read`). No secrets are passed to fork PRs. External previews (e.g. Vercel preview deploys) are not listed as blocking required status checks, preventing forks or external service outages from blocking repository work.

---

## 6. Permissions and Solo Maintainer Workflow

### Maintainer Role (`DevJoaoLopes`):
- Repository administrator.
- Authors feature branches, opens PRs against `main`.
- Inspects checks, reviews diffs, resolves conversations.
- With `required_approving_review_count: 0`, the maintainer can click **Squash and merge** as soon as:
  1. All required status checks (`CI required`, `PR title`) are green (`success`).
  2. The branch is up-to-date with `refs/heads/main`.
  3. All review comment threads are marked resolved.

### Bot Role (`AIK Release Bot`):
- GitHub App created with least-privilege permissions.
- Opens and updates release pull requests via `release-please`.
- Pushes release tags (`v*`) upon release PR merge.
- Operates without bypass rights (`bypass_actors: []`). The maintainer must review and merge release PRs.

---

## 7. Security and Vulnerability Management

Security features are enabled and audited via GitHub API:

| Feature | State | API Verification Endpoint | Purpose |
| --- | --- | --- | --- |
| **Dependabot Security Updates** | `enabled` | `GET repos/.../security_and_analysis` | Automatically submits PRs for vulnerable dependencies. |
| **Vulnerability Alerts** | `enabled` (HTTP 204) | `GET repos/.../vulnerability-alerts` | Alerts maintainers of CVEs affecting dependencies. |
| **Automated Security Fixes** | `enabled` | `GET repos/.../automated-security-fixes` | Generates fix pull requests when advisories are published. |
| **Private Vulnerability Reporting** | `enabled` | `GET repos/.../private-vulnerability-reporting` | Provides private reporting intake for security researchers. |
| **Secret Scanning & Push Protection** | `enabled` | `GET repos/.../security_and_analysis` | Blocks commits containing known secret token formats. |

Security advisories can be filed privately at:
[`https://github.com/DevJoaoLopes/agent-interaction-kit/security/advisories/new`](https://github.com/DevJoaoLopes/agent-interaction-kit/security/advisories/new).

---

## 8. Operational Runbook: Maintenance and Recovery

### Guiding Principles
> [!IMPORTANT]
> **Never disable branch protection as a routine workaround.**
> Disabling rulesets or removing required status checks removes protection for all contributors and opens the main branch to unverified code or broken commits. Always update the ruleset configuration through audited procedures instead of disabling it.

---

### Runbook A: Updating or Renaming Status Checks

If a workflow job is renamed or refactored (e.g., updating the aggregation job in `ci.yml`), the ruleset must be updated to match the new check name.

#### Step 1: Update `.github/rulesets/main.json`
Edit `.github/rulesets/main.json` in your local workspace or branch to reflect the new check context name.

#### Step 2: Update the Active Ruleset via GitHub CLI
Apply the updated JSON directly to ruleset ID `23119836`:

```bash
gh api --method PUT repos/DevJoaoLopes/agent-interaction-kit/rulesets/23119836 \
  --input .github/rulesets/main.json
```

#### Step 3: Verify the Live Ruleset
Confirm the update applied successfully:

```bash
gh api repos/DevJoaoLopes/agent-interaction-kit/rulesets/23119836 \
  --jq '.rules[] | select(.type == "required_status_checks")'
```

---

### Runbook B: Recovering from Broken CI or Runner Outages

If GitHub Actions experiences an outage and an urgent security patch must be merged:

1. **Verify Outage**:
   Check GitHub status at [`https://www.githubstatus.com`](https://www.githubstatus.com) and examine workflow runs:
   ```bash
   gh run list --limit 5
   ```

2. **Temporary Audit Bypass (Emergency Only)**:
   Do **not** delete the ruleset. Instead, add repository admin (`DevJoaoLopes`, `RepositoryRole` actor ID `5`) as a temporary bypass actor:
   ```bash
   # Temporarily grant bypass permissions to Repository Admin (actor_id 5)
   jq '.bypass_actors = [{"actor_id": 5, "actor_type": "RepositoryRole", "bypass_mode": "always"}]' .github/rulesets/main.json | \
     gh api --method PUT repos/DevJoaoLopes/agent-interaction-kit/rulesets/23119836 --input -
   ```

   Confirm temporary bypass is active:
   ```bash
   gh api repos/DevJoaoLopes/agent-interaction-kit/rulesets/23119836 --jq '.bypass_actors'
   # Expected output: [{"actor_id": 5, "actor_type": "RepositoryRole", "bypass_mode": "always"}]
   ```

3. **Immediate Restoration**:
   Re-apply `.github/rulesets/main.json` containing `"bypass_actors": []` as soon as the emergency merge is complete:
   ```bash
   gh api --method PUT repos/DevJoaoLopes/agent-interaction-kit/rulesets/23119836 \
     --input .github/rulesets/main.json
   ```

4. **Verify Bypass Removal**:
   ```bash
   gh api repos/DevJoaoLopes/agent-interaction-kit/rulesets/23119836 --jq '.bypass_actors'
   # Must output: []
   ```

---

### Runbook C: Routine Auditing Commands

Maintainers can periodically verify the active governance rules using the following commands:

```bash
# 1. List all active rulesets
gh api repos/DevJoaoLopes/agent-interaction-kit/rulesets

# 2. Inspect main protection rules
gh api repos/DevJoaoLopes/agent-interaction-kit/rulesets/23119836

# 3. Inspect release tag rules
gh api repos/DevJoaoLopes/agent-interaction-kit/rulesets/23119843

# 4. Check repository merge settings
gh api repos/DevJoaoLopes/agent-interaction-kit \
  --jq '{allow_squash_merge, allow_merge_commit, allow_rebase_merge, squash_merge_commit_title, squash_merge_commit_message, delete_branch_on_merge}'

# 5. Check vulnerability reporting and Dependabot
gh api repos/DevJoaoLopes/agent-interaction-kit/private-vulnerability-reporting
gh api repos/DevJoaoLopes/agent-interaction-kit/automated-security-fixes
```

---

## 9. Proof PR & Live Validation Record

This section documents the live validation protocol and status check tracking for the governance rollout.

### 9.1 Live Validation Protocol

To verify that the branch protection ruleset and required checks operate as designed without deadlocking solo development, follow this sequence:

1. **Branch & Pull Request Creation**:
   Push feature branch `feat/oss-governance` to GitHub and open a pull request targeting `main`:
   ```bash
   gh pr create \
     --base main \
     --head feat/oss-governance \
     --title "ci(governance): add rulesets and governance operations guide" \
     --body-file .superpowers/sdd/2026-09-12-oss-governance/task-5-report.md
   ```

2. **Verify Merge Block on Pending Checks**:
   Inspect the PR status immediately upon creation while CI workflows are queued or running:
   ```bash
   gh pr view <PR_NUMBER> --json mergeable,mergeStateStatus,statusCheckRollup
   ```
   **Expected Behavior**:
   - `mergeStateStatus`: `BLOCKED`
   - Merge button in GitHub UI is disabled with reason: *"Required status checks must pass before merging."*

3. **Live Check Run Monitoring**:
   Monitor the progress of required checks using GitHub CLI:
   ```bash
   gh pr checks <PR_NUMBER> --watch
   ```
   **Monitored Check Runs**:
   - `CI required`: Must report `success` from GitHub Actions (`integration_id: 15368`).
   - `PR title`: Must report `success` from GitHub Actions (`integration_id: 15368`).

4. **Verify Solo Maintainer Merge Authorization**:
   Once both checks report `success`:
   ```bash
   gh pr view <PR_NUMBER> --json mergeable,mergeStateStatus
   ```
   **Expected Behavior**:
   - `mergeStateStatus`: `CLEAN`
   - `mergeable`: `MERGEABLE`
   - Maintainer `DevJoaoLopes` can merge via **Squash and merge** without requiring approvals from any other user (`required_approving_review_count: 0`).
   - All conversation threads must be resolved (`required_review_thread_resolution: true`).

5. **Direct Push & Deletion Invariance**:
   Verify branch immutability:
   - Direct push to `refs/heads/main` rejected by `main-protection` (`deletion`, `non_fast_forward`, `required_linear_history`, `pull_request`).
   - Direct push/delete to `refs/tags/v*` rejected by `release-tags-protection` (`deletion`, `non_fast_forward`).

---

### 9.2 Validation Tracking Record

| PR Identifier | Branch | Title | Status | Monitored Checks | Observed Ruleset Behavior |
| --- | --- | --- | --- | --- | --- |
| **PR A** | `feat/oss-governance` | `docs(governance): setup oss governance, branch protection, and ci gates` | [PR #21](https://github.com/DevJoaoLopes/agent-interaction-kit/pull/21) (CLEAN, Verified) | `CI required` (#15368), `PR title` (#15368) | Verified: merge blocked on invalid title and pending checks; unblocked to CLEAN once green; solo maintainer self-merge permitted. |

