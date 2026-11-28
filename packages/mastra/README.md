# @agent-interaction-kit/mastra

Export an [Agent Interaction Kit](https://github.com/DevJoaoLopes/agent-interaction-kit) provider manifest (`aik.provider.json`) from the tools of a [Mastra](https://mastra.ai) agent, so `aik check` can compare it with what the UI expects.

Requires `@mastra/core` `^1.29.0` (tested with 1.86.0) and Node.js 22.13 or later.

```typescript
import { writeFile } from "node:fs/promises";
import { exportProviderManifest } from "@agent-interaction-kit/mastra";
import { weatherAgent } from "./mastra/agents/weather-agent";

const manifest = await exportProviderManifest({
  agent: weatherAgent,
  producer: { name: "weather-agent", version: "1.0.0", buildId: process.env.GITHUB_SHA ?? "local" },
  protocolProfile: "ag-ui@0.1",
  contextProfile: "default",
});

await writeFile("aik.provider.json", `${JSON.stringify(manifest, null, 2)}\n`);
```

Then run `aik check --provider aik.provider.json --consumer aik.consumer.json --strict` in CI.

You can also pass a record of tools instead of an agent: `exportProviderManifest({ tools, ...metadata })`.

## How tools are mapped

- The tool name is the key in the agent's tool record (what the model sees), not the tool `id`.
- `inputSchema` becomes `parameters` (converted with `io: "input"`); no `inputSchema` becomes `{ type: "object", properties: {} }`.
- `outputSchema` becomes `returns.schema` (converted with `io: "output"`); without it, `returns` is `{ format: "json" }` with no schema.
- A tool with `execute` is a `backend` tool. A tool without `execute` (the client returns the result) is a `frontend` tool.
- `requireApproval: true` becomes `requiresApproval: true`.
- Schemas are converted with `standardSchemaToJSONSchema` from `@mastra/core/schema`. A schema that is not a Standard JSON Schema (for example an AI SDK `jsonSchema()`), or a tool with neither `execute` nor `inputSchema`, throws a `TypeError` that names the tool.

## License

MIT
