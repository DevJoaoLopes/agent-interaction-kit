import assert from "node:assert/strict";
import test from "node:test";
import { channelFor, validateTag } from "./policy.mjs";

test("routes beta to next and stable to latest", () => {
  assert.equal(channelFor("1.0.0-beta.1"), "next");
  assert.equal(channelFor("1.2.3"), "latest");
});

test("rejects invalid, unsupported or mismatched release tags", () => {
  for (const value of ["main", "1.0", "1.0.0-rc.1", "1.0.0-beta.01", "01.0.0", "1.0.0+meta"]) {
    assert.throws(() => channelFor(value));
  }
  assert.throws(() => validateTag("v2.0.0", "1.0.0"));
  assert.throws(() => validateTag("main", "1.0.0"));
  assert.equal(validateTag("v1.0.0-beta.1", "1.0.0-beta.1"), "next");
});
