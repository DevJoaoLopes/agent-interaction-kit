import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../../", import.meta.url));

export function extractTargets(value, targets = []) {
  if (!value) return targets;
  if (typeof value === "string") {
    targets.push(value.replace(/^\.\//, ""));
    return targets;
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      extractTargets(item, targets);
    }
    return targets;
  }
  if (typeof value === "object") {
    for (const val of Object.values(value)) {
      extractTargets(val, targets);
    }
    return targets;
  }
  return targets;
}

export function getRequiredTargets(pkgJson) {
  const targets = [];
  if (pkgJson.bin) {
    extractTargets(pkgJson.bin, targets);
  }
  if (pkgJson.exports) {
    extractTargets(pkgJson.exports, targets);
  }
  return [...new Set(targets)];
}

export function isAllowedPath(filePath) {
  const normalized = path.posix.normalize(filePath.replace(/^\.\//, ""));
  if (normalized.startsWith("../") || path.isAbsolute(normalized)) {
    return false;
  }
  const base = path.posix.basename(normalized);
  if (base === ".env" || base.startsWith(".env.") || base.endsWith(".env")) {
    return false;
  }
  if (base.includes(".test.") || base.includes(".spec.")) {
    return false;
  }
  return (
    normalized === "package.json" ||
    normalized === "README.md" ||
    normalized === "LICENSE" ||
    normalized.startsWith("dist/")
  );
}

export function validatePackContents(files, pkgJson) {
  assert.ok(Array.isArray(files), "Expected files to be an array");
  assert.ok(pkgJson && typeof pkgJson === "object", "Expected package.json object");

  const filePaths = files
    .map((file) => (typeof file === "string" ? file : file?.path))
    .filter(Boolean)
    .map((p) => path.posix.normalize(p.replace(/^\.\//, "")));

  const fileSet = new Set(filePaths);

  const disallowed = filePaths.filter((p) => !isAllowedPath(p));
  if (disallowed.length > 0) {
    throw new Error(`Package contains disallowed files: ${disallowed.join(", ")}`);
  }

  const requiredTargets = getRequiredTargets(pkgJson);
  const missing = requiredTargets.filter((target) => !fileSet.has(target));
  if (missing.length > 0) {
    throw new Error(`Package is missing required targets: ${missing.join(", ")}`);
  }

  return { filePaths, requiredTargets };
}

export function inspectPackage(packageDir) {
  const absDir = path.resolve(packageDir);
  const pkgJsonPath = path.join(absDir, "package.json");
  const pkgJson = JSON.parse(readFileSync(pkgJsonPath, "utf8"));

  const result = spawnSync("npm", ["pack", "--dry-run", "--json"], {
    cwd: absDir,
    encoding: "utf8",
    timeout: 120000,
  });

  if (result.status !== 0) {
    throw new Error(`npm pack --dry-run failed:\n${result.stderr || result.stdout}`);
  }

  const packData = JSON.parse(result.stdout);
  const files = packData[0]?.files;
  if (!Array.isArray(files)) {
    throw new Error("npm pack output did not contain files array");
  }

  return validatePackContents(files, pkgJson);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const targetDir = process.argv[2] || path.join(root, "packages/core");
  try {
    const { filePaths, requiredTargets } = inspectPackage(targetDir);
    console.log(
      JSON.stringify({
        status: "passed",
        package: targetDir,
        fileCount: filePaths.length,
        requiredTargetsCount: requiredTargets.length,
      }),
    );
  } catch (error) {
    console.error(`Pack inspection failed: ${error.message}`);
    process.exit(1);
  }
}
