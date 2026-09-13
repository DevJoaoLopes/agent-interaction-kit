# Agent Interaction Kit (AIK)

> **Contract testing for tool calls between backend AI agents and frontend web apps.**  
> Catch agent-frontend schema drifts in CI before they break chat conversations in production.

[![CI](https://github.com/DevJoaoLopes/agent-interaction-kit/actions/workflows/ci.yml/badge.svg)](https://github.com/DevJoaoLopes/agent-interaction-kit/actions/workflows/ci.yml)
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

### 1. Install

Install the core package in your project as a development dependency:

```bash
npm install --save-dev --save-exact @agent-interaction-kit/core@1.0.0-beta.1
```

### 2. Add Script and Check

Add contract testing to your `package.json` scripts:

```json
{
  "scripts": {
    "test:contracts": "aik check --provider aik.provider.json --consumer aik.consumer.json --strict"
  }
}
```

Run the check:

```bash
npm run test:contracts
```

Or run directly using `npx`:

```bash
npx --no-install aik check --provider aik.provider.json --consumer aik.consumer.json --strict
```

Output:
```text
✔ AIK Check Passed: all tools compatible (context: "default")
  Producer Build: git-b101 | Consumer Build: git-c101

Summary: 3 tools checked, 0 diagnostics.
```

### Ad-hoc Execution

To check contracts without adding AIK to your project dependencies:

```bash
pnpm dlx @agent-interaction-kit/core@1.0.0-beta.1 check \
  --provider aik.provider.json --consumer aik.consumer.json --strict
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

> 💡 **Tip:** Use the [generate-contracts skill](https://github.com/DevJoaoLopes/agent-interaction-kit/blob/main/skills/generate-contracts/SKILL.md) to help extract contracts from your code.

---

## 🚦 CI/CD Integration

Add contract verification to your CI pipeline (e.g. GitHub Actions) with frozen dependency installation:

```yaml
- name: Install dependencies
  run: npm ci

- name: Verify Agent Interaction Contracts
  run: npm run test:contracts
```

Or run directly using the installed binary with `--strict`:

```yaml
- name: Install dependencies
  run: npm ci

- name: Verify Agent Interaction Contracts
  run: |
    npx --no-install aik check \
      --provider ./apps/backend/aik.provider.json \
      --consumer ./apps/frontend/aik.consumer.json \
      --format junit \
      --output test-results/aik.xml \
      --strict
```

### Exit Codes

| Exit Code | Status | Meaning |
| :---: | :--- | :--- |
| **`0`** | `PASS` | All tools and schemas are fully compatible within supported checks. |
| **`1`** | `FAIL` | Breaking contract change detected (CI build should fail). |
| **`2`** | `ERROR` | Invalid input: missing manifest files, malformed JSON, or invalid arguments. |
| **`2`** | `INCONCLUSIVE` | Schema contains unsupported constructs (e.g., `AIK-SCHEMA-001`) under `--strict`. Without `--strict`, exits 0. |

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

## 📋 Diagnostic Codes

| Code | Severity | Description |
| :--- | :--- | :--- |
| **`AIK-TOOL-001`** | `error` | Required tool is missing from the provider manifest. |
| **`AIK-TOOL-002`** | `error` | Tool execution side mismatch (e.g., backend vs frontend). |
| **`AIK-INPUT-001`** | `error` | Mandatory parameter requirement violation (contravariance). |
| **`AIK-INPUT-002`** | `error` | Parameter enum restriction mismatch (contravariance). |
| **`AIK-RESULT-001`** | `error` | Result root type mismatch or missing structured return schema (covariance). |
| **`AIK-RESULT-002`** | `error` | Required result property missing from provider return schema (covariance). |
| **`AIK-RESULT-003`** | `error` | Required result property scalar type incompatible with consumer expectation (covariance). |
| **`AIK-SCHEMA-001`** | `unknown` | Schema contains unsupported constructs outside the safe subset (e.g., `not`, `$ref`). |

---

## 🛠️ Contributing / Local Development

For developing AIK from source in this repository:

```bash
# From repository root
pnpm install --frozen-lockfile
pnpm build:core
pnpm --filter @agent-interaction-kit/core aik check --provider fixtures/valid/provider.json --consumer fixtures/valid/consumer.json --strict
```

See [CONTRIBUTING.md](../../CONTRIBUTING.md) for full guidelines.

---

## 📄 License

MIT © [João Victor Lopes](https://github.com/DevJoaoLopes)

