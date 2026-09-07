# Agent Interaction Kit (AIK)

> **Tool and interaction contract testing for AG-UI applications.**  
> Catch agent-frontend tool divergences before they break user conversations in production.

[![CI](https://github.com/joaopiga/agent-interaction-kit/actions/workflows/ci.yml/badge.svg)](https://github.com/joaopiga/agent-interaction-kit/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

---

## 🎯 The Problem

In agentic UI applications (powered by protocols like **AG-UI** or libraries like **CopilotKit**), the backend agent (e.g., **Microsoft Agent Framework (.NET)** or **Mastra (TypeScript)**) and the frontend web client (React) are frequently built and deployed by separate teams on independent release cycles.

When tool definitions change—such as when a backend tool changes its return payload from a list `[]` to an object `{ items: [...], total: 10 }`, or adds a new mandatory argument:
- The Server-Sent Events (SSE) stream remains syntactically valid.
- No HTTP or network error is raised.
- **The frontend UI silently misbehaves or chat responses become incoherent**, requiring manual chat testing to catch bugs.

**Agent Interaction Kit (AIK)** solves this by introducing **Consumer-Driven Contracts (CDC)** specifically adapted to agent tool interactions.

---

## 🚀 Quickstart

### 1. Install

```bash
# Using pnpm
pnpm add -D @agent-interaction-kit/core

# Using npm
npm install --save-dev @agent-interaction-kit/core
```

### 2. Verify Contracts in CI

```bash
# Compare candidate backend manifest against production frontend expectations
npx aik check --provider ./backend/aik.provider.json --consumer ./frontend/aik.consumer.json
```

#### Exit Codes
- `0`: **PASS** — All tools and schemas are fully compatible.
- `1`: **FAIL** — Breaking change or incompatible schema detected.
- `2`: **ERROR / UNKNOWN** — Missing files, syntax error, or schema constructs outside the verifiable subset (when `--strict` is enabled).

---

## 📖 How It Works: Consumer-Driven Contracts (CDC)

AIK decouples backend and frontend through two independent JSON artifacts:

### 1. Provider Manifest (`aik.provider.json`)
Published by the backend during build:
```json
{
  "$schema": "https://aik.dev/schemas/v1/provider.json",
  "schemaVersion": "1.0.0",
  "producer": {
    "name": "agent-backend",
    "version": "2.0.0",
    "buildId": "git-b201"
  },
  "protocolProfile": "ag-ui@0.1",
  "contextProfile": "default",
  "tools": [
    {
      "name": "searchDocuments",
      "executionSide": "backend",
      "parameters": {
        "type": "object",
        "properties": { "query": { "type": "string" } },
        "required": ["query"]
      },
      "returns": {
        "format": "json",
        "schema": {
          "type": "array",
          "items": {
            "type": "object",
            "properties": { "id": { "type": "string" }, "title": { "type": "string" } },
            "required": ["id", "title"]
          }
        }
      }
    }
  ]
}
```

### 2. Consumer Expectations (`aik.consumer.json`)
Published by the frontend during build:
```json
{
  "$schema": "https://aik.dev/schemas/v1/consumer.json",
  "schemaVersion": "1.0.0",
  "consumer": {
    "name": "web-frontend",
    "version": "1.0.0",
    "buildId": "git-c101"
  },
  "protocolProfile": "ag-ui@0.1",
  "contextProfile": "default",
  "requires": [
    {
      "toolName": "searchDocuments",
      "executionSide": "backend",
      "expectedReturns": {
        "format": "json",
        "schema": {
          "type": "array",
          "items": {
            "type": "object",
            "properties": { "id": { "type": "string" } },
            "required": ["id"]
          }
        }
      }
    }
  ]
}
```

---

## 🔍 Diagnostic Catalog

| Code | Category | Description |
| :--- | :--- | :--- |
| `AIK-TOOL-001` | Tool Presence | Required tool is not declared by provider for the active context profile. |
| `AIK-TOOL-002` | Execution Side | `executionSide` mismatch (`backend` vs `frontend`). |
| `AIK-INPUT-001` | Arguments | Provider requires mandatory argument that consumer does not supply. |
| `AIK-INPUT-002` | Arguments | Enum restriction: consumer supplies a value not accepted by callee. |
| `AIK-RESULT-001` | Results | Root type mismatch (e.g. `array` vs `object`). |
| `AIK-RESULT-002` | Results | Required field expected by consumer is missing or optional in provider return. |
| `AIK-SCHEMA-001` | Safety | Schema contains unsupported construct (`not`, complex pattern). Returns `unknown`. |

---

## 🤖 AI-Assisted Contract Generation (Agent Skill)

AIK comes equipped with an Agent Skill specification at [`skills/generate-contracts/SKILL.md`](skills/generate-contracts/SKILL.md) compatible with coding assistants (Google Antigravity, Cursor, Claude Code, GitHub Copilot).

It automatically scans:
- **C# / .NET**: Methods decorated with `[AIFunction]`, `[Description]`, or Semantic Kernel plugins.
- **TypeScript / React**: Calls to `useCopilotAction` and UI components rendering tool returns.

And generates both `aik.provider.json` and `aik.consumer.json` with zero manual schema writing.

---

## 🛠️ CLI Options

```bash
Usage: aik check [options]

Options:
  -p, --provider <path>  Path to provider manifest (aik.provider.json) [required]
  -c, --consumer <path>  Path to consumer expectations (aik.consumer.json) [required]
  --context <profile>    Context profile to evaluate (default: "default")
  -f, --format <format>  Output format: "terminal", "json", "junit" (default: "terminal")
  -o, --output <path>    Write report to file instead of stdout
  --strict               Treat unknown/inconclusive schemas as failure (exit code 2)
  -h, --help             Display help for command
```

---

## 📦 Programmatic Usage

AIK is structured as a modular TypeScript library with dedicated subpath exports:

```typescript
import { parseProviderManifest, parseConsumerExpectations } from "@agent-interaction-kit/core/contracts";
import { evaluateCompatibility } from "@agent-interaction-kit/core/core";
import { formatTerminalReport } from "@agent-interaction-kit/core/reporters";

const provider = parseProviderManifest(rawProviderJson);
const consumer = parseConsumerExpectations(rawConsumerJson);

if (provider.ok && consumer.ok) {
  const report = evaluateCompatibility(provider.data, consumer.data);
  console.log(formatTerminalReport(report));
}
```

---

## 🗺️ Roadmap

- [x] **M1 (Current):** CDC Contracts, Directional Rule Engine, Multi-format Reporters, CLI, and Agent Skill.
- [ ] **M2:** Frontend Runtime Guard (Middleware for AG-UI and CopilotKit client actions).
- [ ] **M3:** Microsoft Agent Framework (.NET MAF) automatic manifest exporter.
- [ ] **M4:** Mastra automatic manifest exporter.
- [ ] **M5:** Alfa release with E2E sample application.

---

## 📄 License

MIT © [João Piga](https://github.com/joaopiga)
