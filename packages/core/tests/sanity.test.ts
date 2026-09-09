import { describe, expect, it } from "vitest";
import { AIK_VERSION } from "../src/index.js";

describe("Sanity test", () => {
  it("exports AIK version", () => {
    expect(AIK_VERSION).toBe("0.1.0");
  });
});
