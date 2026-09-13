import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
  extractTargets,
  getRequiredTargets,
  inspectPackage,
  isAllowedPath,
  validatePackContents,
} from "./pack-inspect.mjs";

const root = fileURLToPath(new URL("../../", import.meta.url));

test("extractTargets handles string, array, and nested object forms", () => {
  assert.deepEqual(extractTargets("./dist/index.js"), ["dist/index.js"]);
  assert.deepEqual(
    extractTargets({
      import: "./dist/index.js",
      types: "./dist/index.d.ts",
    }),
    ["dist/index.js", "dist/index.d.ts"],
  );
  assert.deepEqual(
    extractTargets({
      ".": {
        import: "./dist/index.js",
      },
      "./sub": ["./dist/sub.js"],
    }),
    ["dist/index.js", "dist/sub.js"],
  );
});

test("isAllowedPath permits only allowed root files and dist/ contents", () => {
  assert.equal(isAllowedPath("package.json"), true);
  assert.equal(isAllowedPath("README.md"), true);
  assert.equal(isAllowedPath("LICENSE"), true);
  assert.equal(isAllowedPath("dist/bin/aik.js"), true);
  assert.equal(isAllowedPath("dist/index.js"), true);
  assert.equal(isAllowedPath("dist/contracts/index.d.ts"), true);

  assert.equal(isAllowedPath(".env"), false);
  assert.equal(isAllowedPath(".env.local"), false);
  assert.equal(isAllowedPath("dist/.env"), false);
  assert.equal(isAllowedPath("src/index.ts"), false);
  assert.equal(isAllowedPath("tests/check.test.ts"), false);
  assert.equal(isAllowedPath("fixtures/valid/provider.json"), false);
  assert.equal(isAllowedPath("../secret.txt"), false);
});

test("validatePackContents accepts valid file list with required targets", () => {
  const pkg = {
    bin: { aik: "./dist/bin/aik.js" },
    exports: {
      ".": { import: "./dist/index.js", types: "./dist/index.d.ts" },
      "./contracts": { import: "./dist/contracts/index.js", types: "./dist/contracts/index.d.ts" },
    },
  };
  const files = [
    { path: "package.json" },
    { path: "README.md" },
    { path: "LICENSE" },
    { path: "dist/bin/aik.js" },
    { path: "dist/index.js" },
    { path: "dist/index.d.ts" },
    { path: "dist/contracts/index.js" },
    { path: "dist/contracts/index.d.ts" },
  ];
  const result = validatePackContents(files, pkg);
  assert.equal(result.filePaths.length, 8);
  assert.equal(result.requiredTargets.length, 5);
});

test("validatePackContents rejects package containing .env files", () => {
  const pkg = {
    bin: { aik: "./dist/bin/aik.js" },
    exports: { ".": "./dist/index.js" },
  };
  const baseFiles = [
    { path: "package.json" },
    { path: "README.md" },
    { path: "LICENSE" },
    { path: "dist/bin/aik.js" },
    { path: "dist/index.js" },
  ];

  for (const envPath of [".env", ".env.local", "dist/.env", "dist/.env.production"]) {
    assert.throws(
      () => validatePackContents([...baseFiles, { path: envPath }], pkg),
      (err) => err.message.includes("Package contains disallowed files"),
    );
  }
});

test("validatePackContents rejects source, test, and fixture files", () => {
  const pkg = {
    bin: { aik: "./dist/bin/aik.js" },
    exports: { ".": "./dist/index.js" },
  };
  const baseFiles = [
    { path: "package.json" },
    { path: "README.md" },
    { path: "LICENSE" },
    { path: "dist/bin/aik.js" },
    { path: "dist/index.js" },
  ];

  for (const leakedPath of [
    "src/index.ts",
    "tests/index.test.ts",
    "fixtures/valid/provider.json",
    "dist/leak.test.js",
  ]) {
    assert.throws(
      () => validatePackContents([...baseFiles, { path: leakedPath }], pkg),
      (err) => err.message.includes("Package contains disallowed files"),
    );
  }
});

test("validatePackContents rejects missing export target", () => {
  const pkg = {
    bin: { aik: "./dist/bin/aik.js" },
    exports: {
      ".": "./dist/index.js",
      "./reporters": "./dist/reporters/index.js",
    },
  };
  const files = [
    { path: "package.json" },
    { path: "README.md" },
    { path: "LICENSE" },
    { path: "dist/bin/aik.js" },
    { path: "dist/index.js" },
  ];

  assert.throws(
    () => validatePackContents(files, pkg),
    (err) => err.message.includes("missing required targets: dist/reporters/index.js"),
  );
});

test("validatePackContents rejects missing bin target", () => {
  const pkg = {
    bin: { aik: "./dist/bin/aik.js" },
    exports: { ".": "./dist/index.js" },
  };
  const files = [
    { path: "package.json" },
    { path: "README.md" },
    { path: "LICENSE" },
    { path: "dist/index.js" },
  ];

  assert.throws(
    () => validatePackContents(files, pkg),
    (err) => err.message.includes("missing required targets: dist/bin/aik.js"),
  );
});

test("inspectPackage validates real packages/core npm pack dry-run", () => {
  const coreDir = path.join(root, "packages/core");
  const result = inspectPackage(coreDir);
  assert.ok(result.filePaths.length > 0);
  assert.ok(result.requiredTargets.length > 0);
  assert.ok(result.requiredTargets.includes("dist/bin/aik.js"));
  assert.ok(result.requiredTargets.includes("dist/index.js"));
  assert.ok(result.requiredTargets.includes("dist/contracts/index.js"));
  assert.ok(result.requiredTargets.includes("dist/core/index.js"));
  assert.ok(result.requiredTargets.includes("dist/reporters/index.js"));
});
