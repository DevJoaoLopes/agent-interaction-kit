import fs from "node:fs";
import { expect, it } from "vitest";
import { AIK_VERSION } from "../src/index.js";

it("exposes the version declared by the npm package", () => {
  const manifest = JSON.parse(fs.readFileSync(new URL("../package.json", import.meta.url), "utf8"));
  expect(AIK_VERSION).toBe(manifest.version);
});
