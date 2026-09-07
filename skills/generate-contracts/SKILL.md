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
