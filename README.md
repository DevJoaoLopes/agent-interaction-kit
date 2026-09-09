# Agent Interaction Kit (AIK)

> **Contract testing for tool calls between backend AI agents and frontend web apps.**  
> Catch agent-frontend schema drifts in CI before they break chat conversations in production.

[![CI Matrix: Node 20, 22, 24](https://github.com/DevJoaoLopes/agent-interaction-kit/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/DevJoaoLopes/agent-interaction-kit/actions/workflows/ci.yml)
[![npm](https://img.shields.io/npm/v/%40agent-interaction-kit%2Fcore?logo=npm)](https://www.npmjs.com/package/@agent-interaction-kit/core)
[![npm downloads](https://img.shields.io/npm/dm/%40agent-interaction-kit%2Fcore?logo=npm)](https://www.npmjs.com/package/@agent-interaction-kit/core)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-3178C6.svg?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)

---

## 💡 Why AIK?

In modern agentic applications (using frameworks like **Mastra**, **Microsoft Agent Framework**, or **LangGraph** paired with UI protocols like **AG-UI** or **CopilotKit**), the backend agent and frontend web client evolve independently.

When a tool schema changes—such as renaming a return field, dropping a required property, or adding a mandatory argument:
- The streaming connection remains HTTP 200 OK.
- No network error is thrown.
- **The frontend silently breaks** (e.g. blank UI widgets, failed client-side action execution, or incoherent chat turns).

**Agent Interaction Kit (AIK)** solves this by applying **Consumer-Driven Contracts (CDC)** to agent tool interactions, catching incompatibilities statically in CI before deployment.

---

## ⚡ Quickstart

This repository uses pnpm workspaces: `packages/core` contains the library, CLI and fixtures; `apps/website` contains the Editorial landing and quickstart. Use Node 24 and pnpm 10.26.1 for the whole repository. The core itself still targets Node 20.

```bash
pnpm install --frozen-lockfile
pnpm build:core
pnpm test
pnpm dev:web
```

See [website deployment](docs/deployment/website.md) for Vercel setup and [the core reference](packages/core/README.md) for package details.

### 1. Build locally

```bash
git clone https://github.com/DevJoaoLopes/agent-interaction-kit.git
cd agent-interaction-kit
pnpm install --frozen-lockfile
pnpm build:core
```

### 2. Run Compatibility Check

Run the locally installed `aik` binary:

```bash
pnpm --filter @agent-interaction-kit/core aik check --provider fixtures/valid/provider.json --consumer fixtures/valid/consumer.json --strict
```

For an ad-hoc check without adding AIK to your project first, invoke the package directly:

```bash
npx @agent-interaction-kit/core check \
  --provider ./backend/aik.provider.json \
  --consumer ./frontend/aik.consumer.json
```

Output:
```text
✔ AIK Check Passed: all tools compatible (context: "default")
  Producer Build: git-b101 | Consumer Build: git-c101

Summary: 3 tools checked, 0 diagnostics.
```

---

## 🔍 How It Works

AIK decouples teams through two lightweight, version-controlled JSON manifests:

```
┌─────────────────────────┐          ┌─────────────────────────┐
│   aik.provider.json     │          │   aik.consumer.json     │
│ (Backend Tool Manifest) │          │ (Frontend Expectations) │
└────────────┬────────────┘          └────────────┬────────────┘
             │                                    │
             └──────────────► aik check ◄─────────┘
                                 │
                     ┌───────────┴───────────┐
                     │ Exit 0: Pass          │
                     │ Exit 1: Breaking Diff │
                     │ Exit 2: Unknown/Error │
                     └───────────────────────┘
```

1. **`aik.provider.json`**: Published by the backend to declare provided tools, parameters, return schemas, and execution side (`backend` or `frontend`).
2. **`aik.consumer.json`**: Published by the frontend to declare required tools, expected parameters, and expected return structures.
3. **`aik check`**: Evaluates directional compatibility:
   - **Tool Presence**: Verifies required tools exist.
   - **Arguments Contravariance**: Ensures the caller satisfies all mandatory arguments and enum restrictions. Supports reverse polarity for frontend-side tools (`executionSide: "frontend"`).
   - **Return Covariance**: Ensures the producer provides all fields expected by the UI.

> 💡 **Tip:** You don't have to write these manifests by hand! Use our ready-to-use Agent Skill at [`skills/generate-contracts/SKILL.md`](skills/generate-contracts/SKILL.md) to let your AI coding assistant (Cursor, Antigravity, Copilot) extract contracts directly from your C# and TypeScript code.

---

## 🚦 CI/CD Integration

Add contract verification directly to your GitHub Actions pipeline:

```yaml
- name: Verify Agent Interaction Contracts
  run: |
    npx aik check \
      --provider ./apps/backend/aik.provider.json \
      --consumer ./apps/frontend/aik.consumer.json \
      --format junit \
      --output test-results/aik.xml
```

### Exit Codes

| Exit Code | Status | Meaning |
| :---: | :--- | :--- |
| **`0`** | `PASS` | All tools and schemas are fully compatible. |
| **`1`** | `FAIL` | Breaking contract change detected (CI build should fail). |
| **`2`** | `ERROR` / `UNKNOWN` | Missing files, invalid JSON, or unanalyzable schema (when `--strict` is enabled). |

---

## 🛠️ CLI Reference

```bash
aik check --provider <path> --consumer <path> [options]
```

| Option | Description | Default |
| :--- | :--- | :--- |
| `-p, --provider <path>` | Path to provider manifest (`aik.provider.json`) | *required* |
| `-c, --consumer <path>` | Path to consumer expectations (`aik.consumer.json`) | *required* |
| `--context <profile>` | Context profile to evaluate | `"default"` |
| `-f, --format <format>` | Output format: `terminal`, `json`, `junit` | `terminal` |
| `-o, --output <path>` | Write report to file (creates directories automatically) | stdout |
| `--strict` | Treat unknown/inconclusive schemas as failure (exit code 2) | `false` |

---

## 📦 Programmatic API

AIK can also be imported as a library in Node.js / TypeScript:

```typescript
import { parseProviderManifest, parseConsumerExpectations } from "@agent-interaction-kit/core/contracts";
import { evaluateCompatibility } from "@agent-interaction-kit/core/core";
import { formatTerminalReport } from "@agent-interaction-kit/core/reporters";

const provider = parseProviderManifest(providerJsonContent);
const consumer = parseConsumerExpectations(consumerJsonContent);

if (provider.ok && consumer.ok) {
  const report = evaluateCompatibility(provider.data, consumer.data);
  console.log(formatTerminalReport(report));
  
  if (report.status === "fail") {
    process.exit(1);
  }
}
```

---

## 📄 License

MIT © [João Victor Lopes](https://github.com/DevJoaoLopes)
