import assert from "node:assert/strict";
import {
  parseConsumerExpectations,
  parseProviderManifest,
} from "@agent-interaction-kit/core/contracts";
import { evaluateCompatibility } from "@agent-interaction-kit/core/core";
import { broken, consumer, provider, unknown } from "../src/data/examples.ts";
const c = parseConsumerExpectations(JSON.stringify(consumer));
assert.ok(c.ok);
for (const [manifest, status, code] of [
  [provider, "pass", undefined],
  [broken, "fail", "AIK-RESULT-002"],
  [unknown, "unknown", "AIK-SCHEMA-001"],
]) {
  const p = parseProviderManifest(JSON.stringify(manifest));
  assert.ok(p.ok);
  const report = evaluateCompatibility(p.data, c.data);
  assert.equal(report.status, status);
  if (code) assert.equal(report.diagnostics[0].code, code);
}
console.log("Website fixtures verified against AIK: pass, fail, unknown.");
