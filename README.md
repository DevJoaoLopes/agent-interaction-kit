# Agent Interaction Kit (AIK)

> **Contract testing for tool calls between backend AI agents and frontend web apps.**  
> Catch agent-frontend schema drifts in CI before they break chat conversations in production.

[![CI Matrix: Node 22, 24](https://github.com/DevJoaoLopes/agent-interaction-kit/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/DevJoaoLopes/agent-interaction-kit/actions/workflows/ci.yml)
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

### 1. Install

> [!NOTE]
> `@agent-interaction-kit/core` is not on npm yet. The commands in this Quickstart are for the first release. Until then, build the package from this repository and install the tarball:
>
> ```bash
> git clone https://github.com/DevJoaoLopes/agent-interaction-kit.git
> cd agent-interaction-kit
> pnpm install --frozen-lockfile
> pnpm build:core
> npm pack --pack-destination .. ./packages/core
> cd ../your-project
> npm install --save-dev ../agent-interaction-kit-core-*.tgz
> ```

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

> 💡 **Tip:** You don't have to write these manifests by hand! Use our ready-to-use Agent Skill at [`skills/generate-contracts/SKILL.md`](skills/generate-contracts/SKILL.md) to let your AI coding assistant (Cursor, Antigravity, Copilot) extract contracts directly from your C# and TypeScript code.

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

### Manifest builders

The builders construct the same manifests in TypeScript, with an explicit return type. Tool lists can be declared with `as const satisfies`:

```typescript
import {
  createConsumerExpectations,
  createProviderManifest,
  toolFromJsonSchema,
} from "@agent-interaction-kit/core/builders";
import type { ToolDescriptor } from "@agent-interaction-kit/core/contracts";

const tools = [
  toolFromJsonSchema({
    name: "searchDocuments",
    executionSide: "backend",
    parameters: { type: "object", properties: { query: { type: "string" } }, required: ["query"] },
    returns: { format: "json", schema: { type: "object", properties: { title: { type: "string" } } } },
  }),
] as const satisfies readonly ToolDescriptor[];

const provider = createProviderManifest({
  producer: { name: "backend", version: "1.0.0", buildId: "b1" },
  protocolProfile: "ag-ui@0.1",
  contextProfile: "default",
  tools,
});
```

`createConsumerExpectations` follows the same pattern for `aik.consumer.json`. `schemaVersion` defaults to `"1.0.0"`. `toolFromJsonSchema` defaults omitted `returns` to `{ format: "json" }` and fills a missing `parameters.type` as `"object"`. It throws a `TypeError` if `parameters.type` is present and is not `"object"`.

### Standard JSON Schema

Convert a Standard JSON Schema (`~standard.jsonSchema`) value to a JSON Schema object targeting draft-07. The result uses the same `Result` type as the parsers: `{ ok: true, data }` or `{ ok: false, errors }`. Conversion failures (for example `z.date()`) are not thrown.

```typescript
import { toJsonSchema } from "@agent-interaction-kit/core/standard-schema";
import { z } from "zod";

const schema = z.object({
  city: z.string(),
  units: z.enum(["c", "f"]).default("c"),
});

const input = toJsonSchema(schema, "input");
const output = toJsonSchema(schema, "output");
// input.ok && input.data.required → ["city"]
// output.ok && output.data.required → ["city", "units"]
```

`io: "input"` and `io: "output"` follow the vendor converter. A schema that only implements Standard Schema validation, without `~standard.jsonSchema`, returns an error result.

## 📋 Diagnostic Codes

| Code | Severity | Description |
| :--- | :--- | :--- |
| **`AIK-TOOL-001`** | `error` | Required tool is missing from the provider manifest. |
| **`AIK-TOOL-002`** | `error` | Tool execution side mismatch (e.g., backend vs frontend). |
| **`AIK-CONTEXT-001`** | `error` | Provider and consumer manifests declare different `contextProfile` values. |
| **`AIK-INPUT-001`** | `error` | Mandatory parameter requirement violation (covariance for backend tools, where the UI reads arguments; contravariance for frontend tools). |
| **`AIK-INPUT-002`** | `error` | Parameter enum restriction mismatch (contravariance). |
| **`AIK-INPUT-003`** | `error` | Parameter scalar type mismatch (covariance for backend tools, where the UI reads arguments; contravariance for frontend tools). |
| **`AIK-RESULT-001`** | `error` | Result root type mismatch or missing structured return schema (covariance). |
| **`AIK-RESULT-002`** | `error` | Required result property missing from provider return schema (covariance). |
| **`AIK-RESULT-003`** | `error` | Required result property scalar type incompatible with consumer expectation (covariance). |
| **`AIK-RESULT-004`** | `error` | Result format mismatch (e.g. json vs text). |
| **`AIK-SCHEMA-001`** | `unknown` | Schema contains unsupported constructs outside the safe subset (e.g., `not`, `$ref`). |

---

## 🛠️ Contributing / Local Development

For developing AIK itself, this repository uses pnpm workspaces (Node >= 22.12, pnpm >= 10.26.1):

```bash
git clone https://github.com/DevJoaoLopes/agent-interaction-kit.git
cd agent-interaction-kit
pnpm install --frozen-lockfile
pnpm build:core
pnpm test
pnpm dev:web
```

See [CONTRIBUTING.md](CONTRIBUTING.md) and [website deployment](docs/deployment/website.md) for details.

---

## 📄 License

MIT © [João Victor Lopes](https://github.com/DevJoaoLopes)
