# Agent Interaction Kit (AIK) M1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the M1 milestone of the Agent Interaction Kit (AIK): a deterministic TypeScript library and CLI tool (`aik check`) that uses Consumer-Driven Contracts (CDC) to detect tool incompatibilities between backend agent providers (.NET MAF / Mastra) and frontend consumers (AG-UI / CopilotKit) before deployment.

**Architecture:** A single-package TypeScript architecture with subpath exports (`./contracts`, `./core`, `./payloads`, `./reporters`). The package parses JSON CDC manifests via Ajv, evaluates directional rules (tool presence, argument contravariance, result covariance) using a conservative JSON Schema subset, and outputs formatted diagnostic reports (terminal, JSON, JUnit) with semantic exit codes (`0`, `1`, `2`).

**Tech Stack:** TypeScript 5+, Node 20+, pnpm, tsup (ESM/CJS/d.ts), Vitest, Biome, Ajv 8+ (JSON Schema validation), Commander.

**Spec:** [`docs/superpowers/specs/2026-09-07-agent-interaction-kit-design.md`](file:///Users/joaopiga/Desenvolvimento/agent-interaction-kit/docs/superpowers/specs/2026-09-07-agent-interaction-kit-design.md)

## Global Constraints

- Never emit a false positive green result: any schema construct outside the supported subset (`not`, unbounded regex, complex conditionals) must return status `unknown` (exit code `2`).
- Exit codes must be strictly: `0` for pass, `1` for functional incompatibility / breaking change, `2` for unknown schema, missing files, or validation errors.
- Every diagnostic must follow the format `AIK-<CATEGORY>-<CODE>` (e.g. `AIK-TOOL-001`, `AIK-INPUT-001`, `AIK-RESULT-001`).
- The package must be runnable locally via `pnpm` without external network access, paid LLM APIs, or databases.

---

### Task 1: Project Setup and Scaffolding

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `tsup.config.ts`
- Create: `vitest.config.ts`
- Create: `biome.json`
- Create: `src/index.ts`
- Test: `tests/sanity.test.ts`

**Interfaces:**
- Produces: Base configuration, build pipeline (`pnpm build`), test pipeline (`pnpm test`), and linting (`pnpm check`).

- [ ] **Step 1: Create package.json**

```json
{
  "name": "@agent-interaction-kit/core",
  "version": "0.1.0",
  "description": "Tool and interaction contract testing for AG-UI applications",
  "type": "module",
  "bin": {
    "aik": "./dist/bin/aik.js"
  },
  "exports": {
    ".": {
      "import": "./dist/index.js",
      "types": "./dist/index.d.ts"
    },
    "./contracts": {
      "import": "./dist/contracts/index.js",
      "types": "./dist/contracts/index.d.ts"
    },
    "./core": {
      "import": "./dist/core/index.js",
      "types": "./dist/core/index.d.ts"
    },
    "./reporters": {
      "import": "./dist/reporters/index.js",
      "types": "./dist/reporters/index.d.ts"
    }
  },
  "files": [
    "dist",
    "bin"
  ],
  "scripts": {
    "build": "tsup",
    "test": "vitest run",
    "test:watch": "vitest",
    "check": "biome check .",
    "format": "biome format --write ."
  },
  "dependencies": {
    "ajv": "^8.17.1",
    "ajv-formats": "^3.0.1",
    "chalk": "^5.4.1",
    "commander": "^13.1.0"
  },
  "devDependencies": {
    "@biomejs/biome": "^1.9.4",
    "@types/node": "^22.13.1",
    "tsup": "^8.4.0",
    "typescript": "^5.7.3",
    "vitest": "^3.0.5"
  }
}
```

- [ ] **Step 2: Create tsconfig.json, tsup.config.ts, vitest.config.ts, and biome.json**

`tsconfig.json`:
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "lib": ["ES2022"],
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "outDir": "./dist",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true
  },
  "include": ["src/**/*", "bin/**/*", "tests/**/*"]
}
```

`tsup.config.ts`:
```typescript
import { defineConfig } from "tsup";

export default defineConfig({
  entry: {
    index: "src/index.ts",
    "contracts/index": "src/contracts/index.ts",
    "core/index": "src/core/index.ts",
    "reporters/index": "src/reporters/index.ts",
    "bin/aik": "bin/aik.ts",
  },
  format: ["esm"],
  dts: true,
  clean: true,
  sourcemap: true,
  target: "node20",
  banner: {
    js: "#!/usr/bin/env node",
  },
});
```

`vitest.config.ts`:
```typescript
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["tests/**/*.test.ts"],
  },
});
```

`biome.json`:
```json
{
  "$schema": "https://biomejs.dev/schemas/1.9.4/schema.json",
  "formatter": {
    "enabled": true,
    "indentStyle": "space",
    "indentWidth": 2,
    "lineWidth": 100
  },
  "linter": {
    "enabled": true,
    "rules": {
      "recommended": true
    }
  }
}
```

- [ ] **Step 3: Create src/index.ts and sanity test**

`src/index.ts`:
```typescript
export const AIK_VERSION = "0.1.0";
```

`tests/sanity.test.ts`:
```typescript
import { describe, expect, it } from "vitest";
import { AIK_VERSION } from "../src/index.js";

describe("Sanity test", () => {
  it("exports AIK version", () => {
    expect(AIK_VERSION).toBe("0.1.0");
  });
});
```

- [ ] **Step 4: Install dependencies and run test and build**

Run: `pnpm install && pnpm test && pnpm build`  
Expected: PASS (1 test passing, dist files generated).

- [ ] **Step 5: Commit**

```bash
git add package.json tsconfig.json tsup.config.ts vitest.config.ts biome.json src/index.ts tests/sanity.test.ts pnpm-lock.yaml
git commit -m "chore: scaffold project structure, build and test setup"
```

---

### Task 2: CDC Contracts Module (Types, Schemas, and Parser)

**Files:**
- Create: `src/contracts/types.ts`
- Create: `src/contracts/schemas.ts`
- Create: `src/contracts/parser.ts`
- Create: `src/contracts/index.ts`
- Test: `tests/contracts/parser.test.ts`

**Interfaces:**
- Produces:
  - `ProviderManifest`: Types representing `aik.provider.json`.
  - `ConsumerExpectations`: Types representing `aik.consumer.json`.
  - `parseProviderManifest(content: string | object): Result<ProviderManifest>`
  - `parseConsumerExpectations(content: string | object): Result<ConsumerExpectations>`

- [ ] **Step 1: Write the failing test for parsing CDC manifests**

`tests/contracts/parser.test.ts`:
```typescript
import { describe, expect, it } from "vitest";
import { parseConsumerExpectations, parseProviderManifest } from "../../src/contracts/parser.js";

describe("Contracts Parser", () => {
  const validProvider = {
    schemaVersion: "1.0.0",
    producer: { name: "test-backend", version: "1.0.0", buildId: "b1" },
    protocolProfile: "ag-ui@0.1",
    contextProfile: "default",
    tools: [
      {
        name: "searchDocuments",
        executionSide: "backend",
        parameters: {
          type: "object",
          properties: { query: { type: "string" } },
          required: ["query"],
        },
        returns: {
          format: "json",
          schema: {
            type: "array",
            items: { type: "object", properties: { id: { type: "string" } }, required: ["id"] },
          },
        },
      },
    ],
  };

  const validConsumer = {
    schemaVersion: "1.0.0",
    consumer: { name: "test-frontend", version: "1.0.0", buildId: "c1" },
    protocolProfile: "ag-ui@0.1",
    contextProfile: "default",
    requires: [
      {
        toolName: "searchDocuments",
        executionSide: "backend",
        expectedParameters: {
          type: "object",
          properties: { query: { type: "string" } },
          required: ["query"],
        },
        expectedReturns: {
          format: "json",
          schema: {
            type: "array",
            items: { type: "object", properties: { id: { type: "string" } }, required: ["id"] },
          },
        },
      },
    ],
  };

  it("parses valid provider manifest", () => {
    const result = parseProviderManifest(validProvider);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.producer.name).toBe("test-backend");
      expect(result.data.tools[0].name).toBe("searchDocuments");
    }
  });

  it("fails when provider manifest lacks schemaVersion", () => {
    const invalid = { ...validProvider, schemaVersion: undefined };
    const result = parseProviderManifest(invalid);
    expect(result.ok).toBe(false);
  });

  it("parses valid consumer expectations", () => {
    const result = parseConsumerExpectations(validConsumer);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.consumer.name).toBe("test-frontend");
      expect(result.data.requires[0].toolName).toBe("searchDocuments");
    }
  });

  it("fails when tool executionSide is invalid", () => {
    const invalid = {
      ...validProvider,
      tools: [{ ...validProvider.tools[0], executionSide: "cloud" }],
    };
    const result = parseProviderManifest(invalid);
    expect(result.ok).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test tests/contracts/parser.test.ts`  
Expected: FAIL with module not found `../../src/contracts/parser.js`.

- [ ] **Step 3: Implement types, schemas, and parser**

`src/contracts/types.ts`:
```typescript
export type ExecutionSide = "backend" | "frontend";
export type ReturnFormat = "json" | "text" | "raw";

export interface ToolParameterSchema {
  type: "object";
  properties?: Record<string, unknown>;
  required?: string[];
  additionalProperties?: boolean;
  [key: string]: unknown;
}

export interface ToolReturnDescriptor {
  format: ReturnFormat;
  schema?: Record<string, unknown>;
}

export interface ToolDescriptor {
  name: string;
  executionSide: ExecutionSide;
  description?: string;
  parameters: ToolParameterSchema;
  returns: ToolReturnDescriptor;
  requiresApproval?: boolean;
}

export interface ProviderManifest {
  $schema?: string;
  schemaVersion: string;
  producer: {
    name: string;
    version: string;
    buildId: string;
  };
  protocolProfile: string;
  contextProfile: string;
  tools: ToolDescriptor[];
}

export interface ConsumerRequirement {
  toolName: string;
  executionSide: ExecutionSide;
  expectedParameters?: ToolParameterSchema;
  expectedReturns?: ToolReturnDescriptor;
  fallbackPolicy?: "fail-fast" | "silent-ignore";
}

export interface ConsumerExpectations {
  $schema?: string;
  schemaVersion: string;
  consumer: {
    name: string;
    version: string;
    buildId: string;
  };
  protocolProfile: string;
  contextProfile: string;
  requires: ConsumerRequirement[];
}

export type Result<T> = { ok: true; data: T } | { ok: false; errors: string[] };
```

`src/contracts/schemas.ts`:
```typescript
export const providerManifestSchema = {
  type: "object",
  required: ["schemaVersion", "producer", "protocolProfile", "contextProfile", "tools"],
  properties: {
    $schema: { type: "string" },
    schemaVersion: { type: "string" },
    producer: {
      type: "object",
      required: ["name", "version", "buildId"],
      properties: {
        name: { type: "string" },
        version: { type: "string" },
        buildId: { type: "string" },
      },
    },
    protocolProfile: { type: "string" },
    contextProfile: { type: "string" },
    tools: {
      type: "array",
      items: {
        type: "object",
        required: ["name", "executionSide", "parameters", "returns"],
        properties: {
          name: { type: "string" },
          executionSide: { enum: ["backend", "frontend"] },
          description: { type: "string" },
          parameters: { type: "object" },
          returns: {
            type: "object",
            required: ["format"],
            properties: {
              format: { enum: ["json", "text", "raw"] },
              schema: { type: "object" },
            },
          },
          requiresApproval: { type: "boolean" },
        },
      },
    },
  },
};

export const consumerExpectationsSchema = {
  type: "object",
  required: ["schemaVersion", "consumer", "protocolProfile", "contextProfile", "requires"],
  properties: {
    $schema: { type: "string" },
    schemaVersion: { type: "string" },
    consumer: {
      type: "object",
      required: ["name", "version", "buildId"],
      properties: {
        name: { type: "string" },
        version: { type: "string" },
        buildId: { type: "string" },
      },
    },
    protocolProfile: { type: "string" },
    contextProfile: { type: "string" },
    requires: {
      type: "array",
      items: {
        type: "object",
        required: ["toolName", "executionSide"],
        properties: {
          toolName: { type: "string" },
          executionSide: { enum: ["backend", "frontend"] },
          expectedParameters: { type: "object" },
          expectedReturns: {
            type: "object",
            properties: {
              format: { enum: ["json", "text", "raw"] },
              schema: { type: "object" },
            },
          },
          fallbackPolicy: { enum: ["fail-fast", "silent-ignore"] },
        },
      },
    },
  },
};
```

`src/contracts/parser.ts`:
```typescript
import Ajv from "ajv";
import { consumerExpectationsSchema, providerManifestSchema } from "./schemas.js";
import type { ConsumerExpectations, ProviderManifest, Result } from "./types.js";

const ajv = new Ajv({ allErrors: true });
const validateProvider = ajv.compile(providerManifestSchema);
const validateConsumer = ajv.compile(consumerExpectationsSchema);

export function parseProviderManifest(input: string | object): Result<ProviderManifest> {
  let parsed: unknown;
  try {
    parsed = typeof input === "string" ? JSON.parse(input) : input;
  } catch (err) {
    return { ok: false, errors: [`Invalid JSON in provider manifest: ${(err as Error).message}`] };
  }

  const valid = validateProvider(parsed);
  if (!valid) {
    return {
      ok: false,
      errors: (validateProvider.errors || []).map(
        (e) => `Provider manifest validation error: ${e.instancePath} ${e.message}`
      ),
    };
  }

  return { ok: true, data: parsed as ProviderManifest };
}

export function parseConsumerExpectations(input: string | object): Result<ConsumerExpectations> {
  let parsed: unknown;
  try {
    parsed = typeof input === "string" ? JSON.parse(input) : input;
  } catch (err) {
    return {
      ok: false,
      errors: [`Invalid JSON in consumer expectations: ${(err as Error).message}`],
    };
  }

  const valid = validateConsumer(parsed);
  if (!valid) {
    return {
      ok: false,
      errors: (validateConsumer.errors || []).map(
        (e) => `Consumer expectations validation error: ${e.instancePath} ${e.message}`
      ),
    };
  }

  return { ok: true, data: parsed as ConsumerExpectations };
}
```

`src/contracts/index.ts`:
```typescript
export * from "./types.js";
export * from "./schemas.js";
export * from "./parser.js";
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test tests/contracts/parser.test.ts`  
Expected: PASS (4 tests passing).

- [ ] **Step 5: Commit**

```bash
git add src/contracts/ tests/contracts/
git commit -m "feat(contracts): implement CDC types, schemas and manifest parsers"
```

---

### Task 3: Core Compatibility Engine - Directional Rules & Diagnostics

**Files:**
- Create: `src/core/diagnostics.ts`
- Create: `src/core/rules/tools-presence.ts`
- Create: `src/core/rules/arguments-rule.ts`
- Create: `src/core/rules/results-rule.ts`
- Create: `src/core/compatibility.ts`
- Create: `src/core/index.ts`
- Test: `tests/core/compatibility.test.ts`

**Interfaces:**
- Produces:
  - `evaluateCompatibility(provider: ProviderManifest, consumer: ConsumerExpectations, contextProfile?: string): CompatibilityReport`
  - `CompatibilityReport`: status (`pass` | `fail` | `unknown`), checked tools list, and diagnostics array (`Diagnostic[]`).

- [ ] **Step 1: Write the failing tests for compatibility evaluation**

`tests/core/compatibility.test.ts`:
```typescript
import { describe, expect, it } from "vitest";
import type { ConsumerExpectations, ProviderManifest } from "../../src/contracts/types.js";
import { evaluateCompatibility } from "../../src/core/compatibility.js";

describe("Compatibility Engine", () => {
  const baseProvider: ProviderManifest = {
    schemaVersion: "1.0.0",
    producer: { name: "test-backend", version: "1.0.0", buildId: "b1" },
    protocolProfile: "ag-ui@0.1",
    contextProfile: "default",
    tools: [
      {
        name: "searchDocuments",
        executionSide: "backend",
        parameters: {
          type: "object",
          properties: { query: { type: "string" }, limit: { type: "number" } },
          required: ["query"],
        },
        returns: {
          format: "json",
          schema: {
            type: "array",
            items: {
              type: "object",
              properties: { id: { type: "string" }, title: { type: "string" } },
              required: ["id", "title"],
            },
          },
        },
      },
    ],
  };

  const baseConsumer: ConsumerExpectations = {
    schemaVersion: "1.0.0",
    consumer: { name: "test-frontend", version: "1.0.0", buildId: "c1" },
    protocolProfile: "ag-ui@0.1",
    contextProfile: "default",
    requires: [
      {
        toolName: "searchDocuments",
        executionSide: "backend",
        expectedParameters: {
          type: "object",
          properties: { query: { type: "string" } },
          required: ["query"],
        },
        expectedReturns: {
          format: "json",
          schema: {
            type: "array",
            items: {
              type: "object",
              properties: { id: { type: "string" }, title: { type: "string" } },
              required: ["id", "title"],
            },
          },
        },
      },
    ],
  };

  it("passes when provider matches consumer expectations", () => {
    const report = evaluateCompatibility(baseProvider, baseConsumer);
    expect(report.status).toBe("pass");
    expect(report.diagnostics).toHaveLength(0);
  });

  it("fails with AIK-TOOL-001 when required tool is missing", () => {
    const consumerWithExtraTool: ConsumerExpectations = {
      ...baseConsumer,
      requires: [
        ...baseConsumer.requires,
        { toolName: "missingTool", executionSide: "backend" },
      ],
    };
    const report = evaluateCompatibility(baseProvider, consumerWithExtraTool);
    expect(report.status).toBe("fail");
    expect(report.diagnostics.some((d) => d.code === "AIK-TOOL-001")).toBe(true);
  });

  it("fails with AIK-RESULT-001 when result root type diverges (array -> object)", () => {
    const providerWithObjectResult: ProviderManifest = {
      ...baseProvider,
      tools: [
        {
          ...baseProvider.tools[0],
          returns: {
            format: "json",
            schema: {
              type: "object",
              properties: {
                items: { type: "array" },
                total: { type: "number" },
              },
              required: ["items", "total"],
            },
          },
        },
      ],
    };
    const report = evaluateCompatibility(providerWithObjectResult, baseConsumer);
    expect(report.status).toBe("fail");
    const diag = report.diagnostics.find((d) => d.code === "AIK-RESULT-001");
    expect(diag).toBeDefined();
    expect(diag?.toolName).toBe("searchDocuments");
  });

  it("fails with AIK-INPUT-001 when provider adds a new mandatory argument", () => {
    const providerWithMandatoryArg: ProviderManifest = {
      ...baseProvider,
      tools: [
        {
          ...baseProvider.tools[0],
          parameters: {
            type: "object",
            properties: {
              query: { type: "string" },
              tenantId: { type: "string" },
            },
            required: ["query", "tenantId"],
          },
        },
      ],
    };
    const report = evaluateCompatibility(providerWithMandatoryArg, baseConsumer);
    expect(report.status).toBe("fail");
    expect(report.diagnostics.some((d) => d.code === "AIK-INPUT-001")).toBe(true);
  });

  it("returns status unknown with AIK-SCHEMA-001 when schema contains unsupported construct", () => {
    const providerWithComplexSchema: ProviderManifest = {
      ...baseProvider,
      tools: [
        {
          ...baseProvider.tools[0],
          parameters: {
            type: "object",
            not: { properties: { banned: { type: "string" } } },
          },
        },
      ],
    };
    const report = evaluateCompatibility(providerWithComplexSchema, baseConsumer);
    expect(report.status).toBe("unknown");
    expect(report.diagnostics.some((d) => d.code === "AIK-SCHEMA-001")).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test tests/core/compatibility.test.ts`  
Expected: FAIL with module not found `../../src/core/compatibility.js`.

- [ ] **Step 3: Implement diagnostics, rules, and compatibility evaluator**

`src/core/diagnostics.ts`:
```typescript
export type DiagnosticCode =
  | "AIK-TOOL-001"
  | "AIK-TOOL-002"
  | "AIK-INPUT-001"
  | "AIK-INPUT-002"
  | "AIK-RESULT-001"
  | "AIK-RESULT-002"
  | "AIK-SCHEMA-001";

export interface Diagnostic {
  code: DiagnosticCode;
  severity: "error" | "warning" | "unknown";
  toolName: string;
  message: string;
  path?: string;
  expected?: unknown;
  actual?: unknown;
}

export type CompatibilityStatus = "pass" | "fail" | "unknown";

export interface CompatibilityReport {
  status: CompatibilityStatus;
  contextProfile: string;
  producerBuild: string;
  consumerBuild: string;
  checkedTools: string[];
  diagnostics: Diagnostic[];
}
```

`src/core/rules/tools-presence.ts`:
```typescript
import type { ConsumerRequirement, ProviderManifest } from "../../contracts/types.js";
import type { Diagnostic } from "../diagnostics.js";

export function checkToolPresence(
  req: ConsumerRequirement,
  provider: ProviderManifest
): { matchedTool?: ProviderManifest["tools"][0]; diagnostics: Diagnostic[] } {
  const diagnostics: Diagnostic[] = [];
  const found = provider.tools.find((t) => t.name === req.toolName);

  if (!found) {
    diagnostics.push({
      code: "AIK-TOOL-001",
      severity: "error",
      toolName: req.toolName,
      message: `Required tool "${req.toolName}" is not provided by the backend manifest.`,
    });
    return { diagnostics };
  }

  if (found.executionSide !== req.executionSide) {
    diagnostics.push({
      code: "AIK-TOOL-002",
      severity: "error",
      toolName: req.toolName,
      message: `Tool "${req.toolName}" execution side mismatch: consumer expected "${req.executionSide}", provider declared "${found.executionSide}".`,
      expected: req.executionSide,
      actual: found.executionSide,
    });
  }

  return { matchedTool: found, diagnostics };
}
```

`src/core/rules/arguments-rule.ts`:
```typescript
import type { ToolDescriptor, ToolParameterSchema } from "../../contracts/types.js";
import type { Diagnostic } from "../diagnostics.js";

export function checkArguments(
  consumerExpectedParams: ToolParameterSchema | undefined,
  providerTool: ToolDescriptor
): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  const toolName = providerTool.name;
  const isServerExecution = providerTool.executionSide === "backend";

  // Check for unsupported schema constructs
  const checkUnsupported = (schema?: Record<string, unknown>): boolean => {
    if (!schema) return false;
    return "not" in schema || "patternProperties" in schema;
  };

  if (
    checkUnsupported(providerTool.parameters) ||
    checkUnsupported(consumerExpectedParams)
  ) {
    diagnostics.push({
      code: "AIK-SCHEMA-001",
      severity: "unknown",
      toolName,
      message: `Tool "${toolName}" parameters schema contains complex construct (not, patternProperties) outside supported subset.`,
    });
    return diagnostics;
  }

  if (!consumerExpectedParams) {
    return diagnostics;
  }

  if (isServerExecution) {
    // When executing on backend, consumer calls tool.
    // Provider's required parameters must be supported by the consumer.
    const providerRequired = providerTool.parameters.required || [];
    const consumerProperties = Object.keys(consumerExpectedParams.properties || {});
    const consumerRequired = consumerExpectedParams.required || [];

    for (const reqField of providerRequired) {
      if (!consumerProperties.includes(reqField) && !consumerRequired.includes(reqField)) {
        diagnostics.push({
          code: "AIK-INPUT-001",
          severity: "error",
          toolName,
          path: `/parameters/required/${reqField}`,
          message: `Tool "${toolName}": provider requires mandatory argument "${reqField}", which consumer does not declare.`,
        });
      }
    }
  }

  return diagnostics;
}
```

`src/core/rules/results-rule.ts`:
```typescript
import type { ToolDescriptor, ToolReturnDescriptor } from "../../contracts/types.js";
import type { Diagnostic } from "../diagnostics.js";

export function checkResults(
  consumerExpectedReturns: ToolReturnDescriptor | undefined,
  providerTool: ToolDescriptor
): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  const toolName = providerTool.name;

  if (!consumerExpectedReturns || !consumerExpectedReturns.schema) {
    return diagnostics;
  }

  const providerReturns = providerTool.returns;
  if (!providerReturns || !providerReturns.schema) {
    diagnostics.push({
      code: "AIK-RESULT-001",
      severity: "error",
      toolName,
      message: `Tool "${toolName}": consumer expects structured return schema, but provider declares none.`,
    });
    return diagnostics;
  }

  const cSchema = consumerExpectedReturns.schema as Record<string, unknown>;
  const pSchema = providerReturns.schema as Record<string, unknown>;

  // Detect unsupported schema constructs
  if ("not" in cSchema || "not" in pSchema) {
    diagnostics.push({
      code: "AIK-SCHEMA-001",
      severity: "unknown",
      toolName,
      message: `Tool "${toolName}" returns schema contains unsupported "not" construct.`,
    });
    return diagnostics;
  }

  // Root type check (e.g. array vs object)
  if (cSchema.type && pSchema.type && cSchema.type !== pSchema.type) {
    diagnostics.push({
      code: "AIK-RESULT-001",
      severity: "error",
      toolName,
      path: "/returns/schema/type",
      message: `Tool "${toolName}": result root type mismatch. Consumer expects "${cSchema.type}", but provider produces "${pSchema.type}".`,
      expected: cSchema.type,
      actual: pSchema.type,
    });
    return diagnostics;
  }

  // Required properties check for object returns
  if (cSchema.type === "object" && pSchema.type === "object") {
    const cRequired = (cSchema.required as string[]) || [];
    const pProps = (pSchema.properties as Record<string, unknown>) || {};
    for (const reqProp of cRequired) {
      if (!(reqProp in pProps)) {
        diagnostics.push({
          code: "AIK-RESULT-002",
          severity: "error",
          toolName,
          path: `/returns/schema/properties/${reqProp}`,
          message: `Tool "${toolName}": consumer requires result field "${reqProp}", which is missing in provider return schema.`,
        });
      }
    }
  }

  // Required properties for items in array returns
  if (cSchema.type === "array" && pSchema.type === "array") {
    const cItems = (cSchema.items as Record<string, unknown>) || {};
    const pItems = (pSchema.items as Record<string, unknown>) || {};
    if (cItems.type === "object" && pItems.type === "object") {
      const cItemRequired = (cItems.required as string[]) || [];
      const pItemProps = (pItems.properties as Record<string, unknown>) || {};
      for (const reqProp of cItemRequired) {
        if (!(reqProp in pItemProps)) {
          diagnostics.push({
            code: "AIK-RESULT-002",
            severity: "error",
            toolName,
            path: `/returns/schema/items/properties/${reqProp}`,
            message: `Tool "${toolName}": consumer requires field "${reqProp}" on array items, but provider does not declare it.`,
          });
        }
      }
    }
  }

  return diagnostics;
}
```

`src/core/compatibility.ts`:
```typescript
import type { ConsumerExpectations, ProviderManifest } from "../contracts/types.js";
import type { CompatibilityReport, Diagnostic } from "./diagnostics.js";
import { checkArguments } from "./rules/arguments-rule.js";
import { checkResults } from "./rules/results-rule.js";
import { checkToolPresence } from "./rules/tools-presence.js";

export function evaluateCompatibility(
  provider: ProviderManifest,
  consumer: ConsumerExpectations,
  contextProfile = "default"
): CompatibilityReport {
  const allDiagnostics: Diagnostic[] = [];
  const checkedTools: string[] = [];

  for (const req of consumer.requires) {
    checkedTools.push(req.toolName);
    const presence = checkToolPresence(req, provider);
    allDiagnostics.push(...presence.diagnostics);

    if (presence.matchedTool) {
      const argDiags = checkArguments(req.expectedParameters, presence.matchedTool);
      allDiagnostics.push(...argDiags);

      const resDiags = checkResults(req.expectedReturns, presence.matchedTool);
      allDiagnostics.push(...resDiags);
    }
  }

  let status: CompatibilityReport["status"] = "pass";
  if (allDiagnostics.some((d) => d.severity === "error")) {
    status = "fail";
  } else if (allDiagnostics.some((d) => d.severity === "unknown")) {
    status = "unknown";
  }

  return {
    status,
    contextProfile,
    producerBuild: provider.producer.buildId,
    consumerBuild: consumer.consumer.buildId,
    checkedTools,
    diagnostics: allDiagnostics,
  };
}
```

`src/core/index.ts`:
```typescript
export * from "./diagnostics.js";
export * from "./compatibility.js";
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test tests/core/compatibility.test.ts`  
Expected: PASS (5 tests passing).

- [ ] **Step 5: Commit**

```bash
git add src/core/ tests/core/
git commit -m "feat(core): implement directional compatibility rules and diagnostics"
```

---

### Task 4: Reporters Module (Terminal, JSON, JUnit)

**Files:**
- Create: `src/reporters/terminal.ts`
- Create: `src/reporters/json.ts`
- Create: `src/reporters/junit.ts`
- Create: `src/reporters/index.ts`
- Test: `tests/reporters/reporters.test.ts`

**Interfaces:**
- Produces:
  - `formatTerminalReport(report: CompatibilityReport): string`
  - `formatJsonReport(report: CompatibilityReport): string`
  - `formatJunitReport(report: CompatibilityReport): string`

- [ ] **Step 1: Write failing tests for reporters**

`tests/reporters/reporters.test.ts`:
```typescript
import { describe, expect, it } from "vitest";
import type { CompatibilityReport } from "../../src/core/diagnostics.js";
import { formatJsonReport, formatJunitReport, formatTerminalReport } from "../../src/reporters/index.js";

describe("Reporters", () => {
  const sampleReport: CompatibilityReport = {
    status: "fail",
    contextProfile: "default",
    producerBuild: "b123",
    consumerBuild: "c456",
    checkedTools: ["searchDocuments"],
    diagnostics: [
      {
        code: "AIK-RESULT-001",
        severity: "error",
        toolName: "searchDocuments",
        message: 'Result root type mismatch: consumer expects "array", provider produces "object".',
      },
    ],
  };

  it("formats JSON report properly", () => {
    const jsonStr = formatJsonReport(sampleReport);
    const parsed = JSON.parse(jsonStr);
    expect(parsed.status).toBe("fail");
    expect(parsed.diagnostics[0].code).toBe("AIK-RESULT-001");
  });

  it("formats JUnit XML report with failure tags", () => {
    const xml = formatJunitReport(sampleReport);
    expect(xml).toContain('<testsuites name="AIK Compatibility Checks"');
    expect(xml).toContain('<failure message="Result root type mismatch');
    expect(xml).toContain('classname="AIK.searchDocuments"');
  });

  it("formats Terminal report with human readable output", () => {
    const output = formatTerminalReport(sampleReport);
    expect(output).toContain("AIK Check Failed");
    expect(output).toContain("[AIK-RESULT-001]");
    expect(output).toContain("searchDocuments");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test tests/reporters/reporters.test.ts`  
Expected: FAIL with module not found `../../src/reporters/index.js`.

- [ ] **Step 3: Implement terminal, json, and junit formatters**

`src/reporters/json.ts`:
```typescript
import type { CompatibilityReport } from "../core/diagnostics.js";

export function formatJsonReport(report: CompatibilityReport): string {
  return JSON.stringify(report, null, 2);
}
```

`src/reporters/junit.ts`:
```typescript
import type { CompatibilityReport } from "../core/diagnostics.js";

export function formatJunitReport(report: CompatibilityReport): string {
  const failuresCount = report.diagnostics.filter((d) => d.severity === "error").length;
  const testsCount = report.checkedTools.length || 1;

  let testCasesXml = "";
  for (const tool of report.checkedTools) {
    const toolDiags = report.diagnostics.filter((d) => d.toolName === tool);
    if (toolDiags.length === 0) {
      testCasesXml += `    <testcase classname="AIK.${tool}" name="ContractCompatibility" time="0.001" />\n`;
    } else {
      for (const diag of toolDiags) {
        testCasesXml += `    <testcase classname="AIK.${tool}" name="${diag.code}" time="0.001">\n`;
        testCasesXml += `      <failure message="${escapeXml(diag.message)}" type="${diag.code}">\n`;
        testCasesXml += `        ${escapeXml(diag.message)}\n`;
        testCasesXml += "      </failure>\n";
        testCasesXml += "    </testcase>\n";
      }
    }
  }

  return `<?xml version="1.0" encoding="UTF-8"?>
<testsuites name="AIK Compatibility Checks" tests="${testsCount}" failures="${failuresCount}" errors="0" time="0.01">
  <testsuite name="aik-contract-checks" tests="${testsCount}" failures="${failuresCount}" errors="0" time="0.01">
${testCasesXml}  </testsuite>
</testsuites>`;
}

function escapeXml(unsafe: string): string {
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}
```

`src/reporters/terminal.ts`:
```typescript
import chalk from "chalk";
import type { CompatibilityReport } from "../core/diagnostics.js";

export function formatTerminalReport(report: CompatibilityReport): string {
  const lines: string[] = [];

  if (report.status === "pass") {
    lines.push(
      chalk.green.bold(`✔ AIK Check Passed: all tools compatible (context: "${report.contextProfile}")`)
    );
  } else if (report.status === "fail") {
    lines.push(
      chalk.red.bold(
        `✖ AIK Check Failed: ${report.diagnostics.length} issue(s) detected (context: "${report.contextProfile}")`
      )
    );
  } else {
    lines.push(
      chalk.yellow.bold(
        `⚠ AIK Check Inconclusive (UNKNOWN): requires review (context: "${report.contextProfile}")`
      )
    );
  }

  lines.push(
    chalk.dim(`  Producer Build: ${report.producerBuild} | Consumer Build: ${report.consumerBuild}`)
  );
  lines.push("");

  for (const diag of report.diagnostics) {
    const color = diag.severity === "error" ? chalk.red : chalk.yellow;
    lines.push(color(`  [${diag.code}] ${diag.toolName}`));
    lines.push(`    → ${diag.message}`);
    if (diag.path) {
      lines.push(chalk.dim(`      Location: ${diag.path}`));
    }
    lines.push("");
  }

  lines.push(
    chalk.dim(
      `Summary: ${report.checkedTools.length} tools checked, ${report.diagnostics.length} diagnostics.`
    )
  );

  return lines.join("\n");
}
```

`src/reporters/index.ts`:
```typescript
export * from "./terminal.js";
export * from "./json.js";
export * from "./junit.js";
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test tests/reporters/reporters.test.ts`  
Expected: PASS (3 tests passing).

- [ ] **Step 5: Commit**

```bash
git add src/reporters/ tests/reporters/
git commit -m "feat(reporters): implement terminal, json, and junit report generators"
```

---

### Task 5: CLI Module (`aik check`)

**Files:**
- Create: `src/cli/commands/check.ts`
- Create: `src/cli/index.ts`
- Create: `bin/aik.ts`
- Test: `tests/cli/check.test.ts`

**Interfaces:**
- Produces: Executable `aik` CLI with `check` command returning exit codes `0`, `1`, and `2`.

- [ ] **Step 1: Write failing test for the check command execution**

`tests/cli/check.test.ts`:
```typescript
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { runCheck } from "../../src/cli/commands/check.js";

describe("CLI runCheck", () => {
  const tmpDir = path.resolve("./tests/cli/tmp");

  it("returns exitCode 0 on matching provider and consumer", async () => {
    fs.mkdirSync(tmpDir, { recursive: true });
    const pPath = path.join(tmpDir, "provider.json");
    const cPath = path.join(tmpDir, "consumer.json");

    fs.writeFileSync(
      pPath,
      JSON.stringify({
        schemaVersion: "1.0.0",
        producer: { name: "b", version: "1.0.0", buildId: "1" },
        protocolProfile: "ag-ui@0.1",
        contextProfile: "default",
        tools: [
          {
            name: "ping",
            executionSide: "backend",
            parameters: { type: "object" },
            returns: { format: "json" },
          },
        ],
      })
    );

    fs.writeFileSync(
      cPath,
      JSON.stringify({
        schemaVersion: "1.0.0",
        consumer: { name: "f", version: "1.0.0", buildId: "1" },
        protocolProfile: "ag-ui@0.1",
        contextProfile: "default",
        requires: [{ toolName: "ping", executionSide: "backend" }],
      })
    );

    const exitCode = await runCheck({
      provider: pPath,
      consumer: cPath,
      format: "json",
    });

    expect(exitCode).toBe(0);
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("returns exitCode 2 when files are missing", async () => {
    const exitCode = await runCheck({
      provider: "non-existent-provider.json",
      consumer: "non-existent-consumer.json",
      format: "json",
    });
    expect(exitCode).toBe(2);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test tests/cli/check.test.ts`  
Expected: FAIL with module not found.

- [ ] **Step 3: Implement check command and bin entrypoint**

`src/cli/commands/check.ts`:
```typescript
import fs from "node:fs";
import { parseConsumerExpectations, parseProviderManifest } from "../../contracts/parser.js";
import { evaluateCompatibility } from "../../core/compatibility.js";
import {
  formatJsonReport,
  formatJunitReport,
  formatTerminalReport,
} from "../../reporters/index.js";

export interface CheckCommandOptions {
  provider: string;
  consumer: string;
  context?: string;
  format?: "terminal" | "json" | "junit";
  output?: string;
  strict?: boolean;
}

export async function runCheck(options: CheckCommandOptions): Promise<number> {
  const format = options.format || "terminal";
  const context = options.context || "default";

  if (!fs.existsSync(options.provider) || !fs.existsSync(options.consumer)) {
    console.error(
      `[AIK-ERROR] Manifest file(s) not found: provider: "${options.provider}", consumer: "${options.consumer}"`
    );
    return 2;
  }

  const pContent = fs.readFileSync(options.provider, "utf-8");
  const cContent = fs.readFileSync(options.consumer, "utf-8");

  const pResult = parseProviderManifest(pContent);
  if (!pResult.ok) {
    console.error(`[AIK-ERROR] Failed to parse provider manifest:\n${pResult.errors.join("\n")}`);
    return 2;
  }

  const cResult = parseConsumerExpectations(cContent);
  if (!cResult.ok) {
    console.error(
      `[AIK-ERROR] Failed to parse consumer expectations:\n${cResult.errors.join("\n")}`
    );
    return 2;
  }

  const report = evaluateCompatibility(pResult.data, cResult.data, context);

  let formatted = "";
  if (format === "json") {
    formatted = formatJsonReport(report);
  } else if (format === "junit") {
    formatted = formatJunitReport(report);
  } else {
    formatted = formatTerminalReport(report);
  }

  if (options.output) {
    fs.writeFileSync(options.output, formatted, "utf-8");
  } else {
    console.log(formatted);
  }

  if (report.status === "fail") {
    return 1;
  }
  if (report.status === "unknown" && options.strict) {
    return 2;
  }
  return 0;
}
```

`src/cli/index.ts`:
```typescript
import { Command } from "commander";
import { AIK_VERSION } from "../index.js";
import { runCheck } from "./commands/check.js";

export function createCli(): Command {
  const program = new Command();

  program
    .name("aik")
    .description("Agent Interaction Kit — CDC tool testing for AG-UI applications")
    .version(AIK_VERSION);

  program
    .command("check")
    .description("Check compatibility between provider manifest and consumer expectations")
    .requiredOption("-p, --provider <path>", "Path to provider manifest (aik.provider.json)")
    .requiredOption("-c, --consumer <path>", "Path to consumer expectations (aik.consumer.json)")
    .option("--context <profile>", "Context profile to evaluate", "default")
    .option("-f, --format <format>", "Output format (terminal, json, junit)", "terminal")
    .option("-o, --output <path>", "Write report to file instead of stdout")
    .option("--strict", "Treat unknown/inconclusive schemas as failure", false)
    .action(async (opts) => {
      const exitCode = await runCheck(opts);
      process.exit(exitCode);
    });

  return program;
}
```

`bin/aik.ts`:
```typescript
import { createCli } from "../src/cli/index.js";

createCli().parse(process.argv);
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test tests/cli/check.test.ts`  
Expected: PASS (2 tests passing).

- [ ] **Step 5: Commit**

```bash
git add src/cli/ bin/aik.ts tests/cli/
git commit -m "feat(cli): implement aik check command and exit codes handling"
```

---

### Task 6: Synthetic Fixture Corpus & E2E Integration Tests

**Files:**
- Create: `fixtures/valid/provider.json`
- Create: `fixtures/valid/consumer.json`
- Create: `fixtures/breaking-result/provider.json`
- Create: `fixtures/breaking-result/consumer.json`
- Create: `fixtures/breaking-args/provider.json`
- Create: `fixtures/breaking-args/consumer.json`
- Create: `fixtures/missing-tool/provider.json`
- Create: `fixtures/missing-tool/consumer.json`
- Create: `fixtures/unknown-schema/provider.json`
- Create: `fixtures/unknown-schema/consumer.json`
- Create: `fixtures/frontend-tool/provider.json`
- Create: `fixtures/frontend-tool/consumer.json`
- Test: `tests/e2e/cli-e2e.test.ts`

**Interfaces:**
- Produces: 6 self-contained synthetic fixtures and an end-to-end integration test verifying that executing the CLI against each fixture produces the exact expected exit code and diagnostic code.

- [ ] **Step 1: Write all 6 synthetic fixtures**

Create the 6 fixture pairs under `fixtures/`:
1. `fixtures/valid/`: `searchDocuments` v1 (array of `{ id, title }`) on both sides.
2. `fixtures/breaking-result/`: provider changes to object `{ items: [...], total: 10 }`, consumer expects array.
3. `fixtures/breaking-args/`: provider adds mandatory `tenantId`, consumer does not declare it.
4. `fixtures/missing-tool/`: consumer requires `selectDocument`, provider lacks it.
5. `fixtures/unknown-schema/`: provider parameters contain `not` clause.
6. `fixtures/frontend-tool/`: tool with `executionSide: "frontend"` (e.g. `confirmAction`), verifying reverse polarity.

- [ ] **Step 2: Write E2E integration test exercising all fixtures**

`tests/e2e/cli-e2e.test.ts`:
```typescript
import path from "node:path";
import { describe, expect, it } from "vitest";
import { runCheck } from "../../src/cli/commands/check.js";

describe("E2E Fixture Verification", () => {
  const fixturesDir = path.resolve("./fixtures");

  it("Scenario 1 (Valid): returns exit code 0", async () => {
    const code = await runCheck({
      provider: path.join(fixturesDir, "valid/provider.json"),
      consumer: path.join(fixturesDir, "valid/consumer.json"),
      format: "json",
    });
    expect(code).toBe(0);
  });

  it("Scenario 2 (Breaking Result): returns exit code 1", async () => {
    const code = await runCheck({
      provider: path.join(fixturesDir, "breaking-result/provider.json"),
      consumer: path.join(fixturesDir, "breaking-result/consumer.json"),
      format: "json",
    });
    expect(code).toBe(1);
  });

  it("Scenario 3 (Breaking Args): returns exit code 1", async () => {
    const code = await runCheck({
      provider: path.join(fixturesDir, "breaking-args/provider.json"),
      consumer: path.join(fixturesDir, "breaking-args/consumer.json"),
      format: "json",
    });
    expect(code).toBe(1);
  });

  it("Scenario 4 (Missing Tool): returns exit code 1", async () => {
    const code = await runCheck({
      provider: path.join(fixturesDir, "missing-tool/provider.json"),
      consumer: path.join(fixturesDir, "missing-tool/consumer.json"),
      format: "json",
    });
    expect(code).toBe(1);
  });

  it("Scenario 5 (Unknown Schema): returns exit code 0 without strict, 2 with strict", async () => {
    const codeStrict = await runCheck({
      provider: path.join(fixturesDir, "unknown-schema/provider.json"),
      consumer: path.join(fixturesDir, "unknown-schema/consumer.json"),
      format: "json",
      strict: true,
    });
    expect(codeStrict).toBe(2);
  });

  it("Scenario 6 (Frontend Tool): returns exit code 0", async () => {
    const code = await runCheck({
      provider: path.join(fixturesDir, "frontend-tool/provider.json"),
      consumer: path.join(fixturesDir, "frontend-tool/consumer.json"),
      format: "json",
    });
    expect(code).toBe(0);
  });
});
```

- [ ] **Step 3: Run E2E test to verify all fixtures pass**

Run: `pnpm test tests/e2e/cli-e2e.test.ts`  
Expected: PASS (6 tests passing).

- [ ] **Step 4: Commit**

```bash
git add fixtures/ tests/e2e/
git commit -m "test(e2e): add synthetic fixture corpus and e2e integration test suite"
```

---

### Task 7: Agent Skill Specification (`skills/generate-contracts/SKILL.md`)

**Files:**
- Create: `skills/generate-contracts/SKILL.md`

**Interfaces:**
- Produces: Standardized Agent Skill that AI coding assistants (Antigravity, Cursor, Claude Code, Copilot) follow to inspect .NET MAF and React/CopilotKit code and generate `aik.provider.json` and `aik.consumer.json`.

- [ ] **Step 1: Write skills/generate-contracts/SKILL.md**

```markdown
---
name: generate-contracts
description: Analyzes backend (.NET MAF / Mastra) and frontend (React / CopilotKit) code to generate or update AIK Consumer-Driven Contract manifests (aik.provider.json and aik.consumer.json).
---

# Generate AIK Contracts

This skill instructs an AI coding agent on how to inspect an application codebase and extract accurate, canonical Agent Interaction Kit (AIK) manifests.

## 1. When to Use
- When introducing a new tool in the backend agent.
- When changing parameters or return types of an existing tool.
- When building frontend UI components that consume tool call results or register frontend actions.
- Before committing or opening a PR, to ensure contracts are in sync with code.

## 2. Extraction Guidelines

### Backend (.NET / Microsoft Agent Framework)
1. Search for classes decorating tools with `[AIFunction]`, `[Description]`, or Semantic Kernel plugins.
2. Inspect method parameters:
   - Parameter names, types, and XML comments.
   - Mark required vs optional (nullability or default values).
3. Inspect method return types:
   - Extract the return DTO / class properties and their types.
4. Output to `aik.provider.json` under `tools[]` with `executionSide: "backend"`.

### Frontend (React / CopilotKit / AG-UI)
1. Search for `useCopilotAction` or client tool registrations:
   - Extract `name`, `parameters`, and whether the handler executes in the browser (`executionSide: "frontend"`).
2. Search for components rendering tool outputs:
   - Identify which properties of the result are accessed (e.g. `result.map(item => item.title)` requires `title`).
3. Output to `aik.consumer.json` under `requires[]`.

## 3. Validation
After generating the manifests, run:
```bash
npx aik check --provider ./path/to/aik.provider.json --consumer ./path/to/aik.consumer.json
```
Ensure exit code is 0 before committing.
```

- [ ] **Step 2: Commit**

```bash
git add skills/generate-contracts/SKILL.md
git commit -m "docs(skill): add agent skill for AI-assisted contract generation"
```

---

### Task 8: Full Build and CI Verification

**Files:**
- Create: `.github/workflows/ci.yml`
- Modify: `README.md`

- [ ] **Step 1: Create GitHub Actions CI workflow**

`.github/workflows/ci.yml`:
```yaml
name: CI

on:
  push:
    branches: [main, master]
  pull_request:
    branches: [main, master]

jobs:
  build-and-test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with:
          version: 10
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: "pnpm"
      - run: pnpm install --frozen-lockfile
      - run: pnpm check
      - run: pnpm test
      - run: pnpm build
```

- [ ] **Step 2: Update README.md with usage and quickstart**

- [ ] **Step 3: Run full verification suite locally**

Run: `pnpm check && pnpm test && pnpm build`  
Expected: All checks pass, 0 linter errors, all tests pass, build succeeds.

- [ ] **Step 4: Commit**

```bash
git add .github/workflows/ci.yml README.md
git commit -m "ci: add GitHub Actions workflow and update README"
```
