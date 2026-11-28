import { defineConfig } from "tsup";

export default defineConfig([
  {
    entry: {
      index: "src/index.ts",
      "contracts/index": "src/contracts/index.ts",
      "core/index": "src/core/index.ts",
      "reporters/index": "src/reporters/index.ts",
      "builders/index": "src/builders/index.ts",
      "standard-schema/index": "src/standard-schema/index.ts",
      "ag-ui/index": "src/ag-ui/index.ts",
    },
    format: ["esm"],
    dts: true,
    clean: true,
    sourcemap: true,
    target: "node22",
  },
  {
    entry: {
      "bin/aik": "bin/aik.ts",
    },
    format: ["esm"],
    dts: false,
    clean: false,
    sourcemap: true,
    target: "node22",
    banner: {
      js: "#!/usr/bin/env node",
    },
  },
]);
