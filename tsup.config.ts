import { defineConfig } from "tsup";

export default defineConfig([
  {
    entry: {
      index: "src/index.ts",
      "contracts/index": "src/contracts/index.ts",
      "core/index": "src/core/index.ts",
      "reporters/index": "src/reporters/index.ts",
    },
    format: ["esm"],
    dts: true,
    clean: true,
    sourcemap: true,
    target: "node20",
  },
  {
    entry: {
      "bin/aik": "bin/aik.ts",
    },
    format: ["esm"],
    dts: false,
    clean: false,
    sourcemap: true,
    target: "node20",
    banner: {
      js: "#!/usr/bin/env node",
    },
  },
]);
