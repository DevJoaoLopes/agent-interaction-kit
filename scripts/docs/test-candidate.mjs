import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../../", import.meta.url));
export const candidateIdentity = {
  expectedVersion: "0.1.0",
  expectedSiteSha: "abcd1234".repeat(5),
};
let candidateDir;
let built = false;
let packDir;
let tarball;

function buildSite() {
  if (built) return;
  candidateDir = mkdtempSync(path.join(os.tmpdir(), "aik-docs-candidate-"));
  const prebuild = spawnSync("pnpm", ["--filter", "@agent-interaction-kit/website", "prebuild"], {
    cwd: root,
    encoding: "utf8",
  });
  assert.equal(prebuild.status, 0, prebuild.stdout + prebuild.stderr);
  const build = spawnSync(
    "pnpm",
    [
      "--filter",
      "@agent-interaction-kit/website",
      "exec",
      "astro",
      "build",
      "--outDir",
      candidateDir,
    ],
    {
      cwd: root,
      encoding: "utf8",
      env: {
        ...process.env,
        PUBLIC_AIK_VERSION: "0.1.0",
        PUBLIC_SITE_SHA: candidateIdentity.expectedSiteSha,
        PUBLIC_AIK_RELEASE_TAG: "v0.1.0",
        VERCEL_ENV: "preview",
      },
    },
  );
  assert.equal(build.status, 0, build.stdout + build.stderr);
  built = true;
}

export function sitePage(route) {
  buildSite();
  return readFileSync(path.join(candidateDir, route, "index.html"), "utf8");
}

export function getCoreTarball() {
  if (tarball) return tarball;
  buildSite();
  packDir = mkdtempSync(path.join(os.tmpdir(), "aik-docs-test-"));
  const result = spawnSync("npm", ["pack", "--json", "--pack-destination", packDir], {
    cwd: path.join(root, "packages/core"),
    encoding: "utf8",
  });
  assert.equal(result.status, 0, result.stderr);
  tarball = path.join(packDir, JSON.parse(result.stdout)[0].filename);
  return tarball;
}

export function cleanupCandidate() {
  if (packDir) rmSync(packDir, { recursive: true, force: true });
  if (candidateDir) rmSync(candidateDir, { recursive: true, force: true });
}

// All default responses are the actual built candidate, including both manifests.
// Overrides mutate that public response for negative tests without editing source.
export async function startMockServer(routes = {}) {
  buildSite();
  const server = http.createServer((req, res) => {
    if (routes[req.url]) return routes[req.url](req, res);
    const pathname = new URL(req.url, "http://localhost").pathname;
    const relative = pathname.endsWith("/") ? `${pathname}index.html` : pathname;
    const file = path.join(candidateDir, relative);
    if (!file.startsWith(`${candidateDir}${path.sep}`) || !existsSync(file)) {
      res.writeHead(404);
      return res.end("Not Found");
    }
    const types = {
      ".json": "application/json",
      ".html": "text/html",
      ".js": "text/javascript",
      ".css": "text/css",
      ".svg": "image/svg+xml",
    };
    res.setHeader("Content-Type", types[path.extname(file)] ?? "application/octet-stream");
    res.end(readFileSync(file));
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  return {
    origin: `http://127.0.0.1:${server.address().port}`,
    close: () => new Promise((resolve) => server.close(resolve)),
  };
}

export function runCli(args, options = {}) {
  return new Promise((resolve, reject) => {
    const proc = spawn(
      process.execPath,
      [path.join(root, "scripts/docs/verify-published.mjs"), ...args],
      {
        ...options,
        env: { ...process.env, ...options.env },
      },
    );
    let stdout = "";
    let stderr = "";
    proc.stdout.on("data", (data) => {
      stdout += data;
    });
    proc.stderr.on("data", (data) => {
      stderr += data;
    });
    proc.on("error", reject);
    proc.on("close", (status) => resolve({ status, stdout, stderr }));
  });
}
