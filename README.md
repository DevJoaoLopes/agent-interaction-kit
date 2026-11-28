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

### Generate a manifest from a tool list

```bash
aik manifest --from <tools-json|ag-ui> <input.json> [options]
```

`aik manifest` writes a provider manifest from a JSON file of tool definitions, so you can export tools from any stack and keep `aik check` in CI. It exits `2` (and writes nothing) when the input is invalid.

- `--from tools-json`: an array of tools, or an object with a `tools` array. Each tool has `name`, `description?`, `executionSide`, `parameters` (a JSON Schema object), `returns?` (`{ format?, schema? }`) and `requiresApproval?`. The object form can also carry `producer`, `protocolProfile`, `contextProfile` and `schemaVersion`.
- `--from ag-ui`: an AG-UI `Tool[]`, or a `RunAgentInput` with a `tools` array. Tools default to `frontend`.

| Option | Description | Default |
| :--- | :--- | :--- |
| `--execution-side <side>` | `backend` or `frontend`, for tools without one. Required for `tools-json` tools that do not set `executionSide` | `frontend` for `ag-ui` |
| `--producer-name`, `--producer-version`, `--build-id` | Producer metadata; override the file. All three are required, from flags or from the file | none |
| `--protocol-profile <profile>` | Protocol profile | `"ag-ui@0.1"` |
| `--context-profile <profile>` | Context profile | `"default"` |
| `--side <side>` | Manifest to generate; only `provider` is supported | `"provider"` |
| `-o, --output <path>` | Write the manifest to a file (creates directories automatically) | stdout |

```bash
aik manifest --from ag-ui run-agent-input.json \
  --producer-name booking-agent --producer-version 1.0.0 --build-id "$GIT_SHA" \
  -o aik.provider.json
```

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

### AG-UI tools

`fromAgUiTools` maps the AG-UI `Tool` list (`RunAgentInput.tools`) to `ToolDescriptor[]`. The core does not depend on `@ag-ui/core`: the parameter type is structural, so the AG-UI `Tool` type is accepted as is.

```typescript
import { fromAgUiTools } from "@agent-interaction-kit/core/ag-ui";

const tools = fromAgUiTools(input.tools); // executionSide: "frontend"
const backendTools = fromAgUiTools(listedByAgent, { executionSide: "backend" });
```

AG-UI tools are supplied by the client, so `executionSide` defaults to `"frontend"`. A missing, `null` or empty `parameters` becomes `{ type: "object", properties: {} }`; `metadata` is ignored; `returns` is `{ format: "json" }`. A `parameters` value that is not a JSON Schema object throws a `TypeError`.

### Microsoft Agent Framework (.NET)

A C# exporter turns the `AIFunctionDeclaration` tools of an MAF agent (name, description, argument and return JSON Schema) into the tools-json format that `aik manifest --from tools-json` reads. See [`examples/maf-dotnet`](https://github.com/DevJoaoLopes/agent-interaction-kit/tree/main/examples/maf-dotnet).

### Frontend tool contracts

`defineToolContract` declares a tool once, from a Zod 4 (or any Standard JSON Schema) schema. It returns the config that CopilotKit's v2 hooks accept and the `ConsumerRequirement` for `aik.consumer.json`.

```tsx
import { createConsumerExpectations, defineToolContract } from "@agent-interaction-kit/core/builders";
import { useFrontendTool } from "@copilotkit/react-core/v2";
import { z } from "zod";

export const getWeather = defineToolContract({
  name: "getWeather",
  description: "Get the weather for a city",
  parameters: z.object({ city: z.string() }),
  returns: z.object({ temperature: z.number() }),
});

function Weather() {
  useFrontendTool({
    ...getWeather.tool,
    handler: async ({ city }) => ({ temperature: await lookup(city) }),
  });
  return null;
}

export const consumer = createConsumerExpectations({
  consumer: { name: "web", version: "1.0.0", buildId: "c1" },
  protocolProfile: "ag-ui@0.1",
  contextProfile: "default",
  requires: [getWeather.requirement],
});
```

For a backend tool that the UI only renders, pass `executionSide: "backend"` and spread `tool` into `useRenderTool` together with `render`. `parameters` is converted with `io: "input"` and `returns` with `io: "output"`. A schema that cannot be converted, or `parameters` that is not an object schema, throws a `TypeError` when the contract is defined.

### Mastra agents

The `@agent-interaction-kit/mastra` package exports a provider manifest straight from a Mastra agent's tools, with `@mastra/core` as a peer dependency:

```typescript
import { exportProviderManifest } from "@agent-interaction-kit/mastra";

const manifest = await exportProviderManifest({
  agent,
  producer: { name: "backend", version: "1.0.0", buildId: "b1" },
  protocolProfile: "ag-ui@0.1",
  contextProfile: "default",
});
```

See [`packages/mastra`](packages/mastra/README.md) for how tools are mapped.

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
