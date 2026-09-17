import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import path from "node:path";
import test from "node:test";
import { createPackageConsumer, smokePackage } from "../release/smoke-package.mjs";
import {
  candidateIdentity,
  cleanupCandidate,
  getCoreTarball,
  runCli,
  sitePage,
  startMockServer,
} from "./test-candidate.mjs";
import { verifyPublished } from "./verify-published.mjs";
test.after(cleanupCandidate);

// Every integration scenario pins the independently configured test candidate.
const verifyCandidate = (options) => verifyPublished({ ...candidateIdentity, ...options });
const candidateVersion = candidateIdentity.expectedVersion;
const candidatePackage = `@agent-interaction-kit/core@${candidateVersion}`;

test("verifyPublished rejects missing siteUrl", async () => {
  await assert.rejects(
    () => verifyCandidate({ siteUrl: "" }),
    /Usage: verify-published\.mjs <site-url>/,
  );
});

test("verifyPublished rejects invalid site URL and non-http protocols", async () => {
  await assert.rejects(() => verifyCandidate({ siteUrl: "not-a-valid-url" }), /Invalid site URL/);
  await assert.rejects(
    () => verifyCandidate({ siteUrl: "ftp://127.0.0.1:4322" }),
    /Invalid protocol 'ftp:'; http or https required/,
  );
});

test("verifyPublished rejects naked 'aik' package targets", async () => {
  await assert.rejects(
    () => verifyCandidate({ siteUrl: "http://127.0.0.1:4322", packageTarget: "aik" }),
    /Unsupported packageTarget/,
  );
  await assert.rejects(
    () => verifyCandidate({ siteUrl: "http://127.0.0.1:4322", packageTarget: "aik@1.0.0" }),
    /Unsupported packageTarget/,
  );
});

test("verifyPublished rejects non-existent tarball path", async () => {
  await assert.rejects(
    () =>
      verifyCandidate({
        siteUrl: "http://127.0.0.1:4322",
        testTarball: path.resolve("nonexistent-package.tgz"),
      }),
    /Package tarball does not exist/,
  );
});

test("verifyPublished rejects non-200 /version.json response", async () => {
  const server = await startMockServer({
    "/version.json": (req, res) => {
      res.writeHead(500, { "Content-Type": "text/plain" });
      res.end("Internal Server Error");
    },
  });
  try {
    await assert.rejects(
      () => verifyCandidate({ siteUrl: server.origin }),
      /Failed to fetch \/version\.json.*HTTP 500/,
    );
  } finally {
    await server.close();
  }
});

test("verifyPublished rejects malformed JSON or missing fields in /version.json", async () => {
  const server = await startMockServer({
    "/version.json": (req, res) => {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end("{ invalid: json");
    },
  });
  try {
    await assert.rejects(
      () => verifyCandidate({ siteUrl: server.origin }),
      /Malformed JSON in \/version\.json/,
    );
  } finally {
    await server.close();
  }

  const serverMissingField = await startMockServer({
    "/version.json": (req, res) => {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ version: "" }));
    },
  });
  try {
    await assert.rejects(
      () => verifyCandidate({ siteUrl: serverMissingField.origin }),
      /Invalid \/version\.json: missing or empty 'version'/,
    );
  } finally {
    await serverMissingField.close();
  }
});

test("verifyPublished rejects version mismatch against expectedVersion", async () => {
  const server = await startMockServer();
  try {
    await assert.rejects(
      () =>
        verifyCandidate({
          siteUrl: server.origin,
          expectedVersion: "9.9.9",
        }),
      { message: `Version mismatch: expected '9.9.9', but site reports '${candidateVersion}'` },
    );
  } finally {
    await server.close();
  }
});

test("verifyPublished rejects failing or malformed manifest endpoints", async () => {
  const serverMissingProvider = await startMockServer({
    "/examples/provider.json": (req, res) => {
      res.writeHead(404, { "Content-Type": "text/plain" });
      res.end("Not Found");
    },
  });
  try {
    await assert.rejects(
      () => verifyCandidate({ siteUrl: serverMissingProvider.origin }),
      /Failed to fetch \/examples\/provider\.json.*HTTP 404/,
    );
  } finally {
    await serverMissingProvider.close();
  }

  const serverInvalidConsumer = await startMockServer({
    "/examples/consumer.json": (req, res) => {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end("{ corrupted json");
    },
  });
  try {
    await assert.rejects(
      () => verifyCandidate({ siteUrl: serverInvalidConsumer.origin }),
      /Malformed JSON in \/examples\/consumer\.json/,
    );
  } finally {
    await serverInvalidConsumer.close();
  }
});

test("verifyPublished detects failure during negative check scenarios", async () => {
  const server = await startMockServer();
  const tarball = getCoreTarball();

  // Test that if negative non-existent check were to return 0 instead of 2, it would throw
  const mockExec = (cmd, args, opts) => {
    // Let install and first checks pass, but make negative path exit 0 instead of 2
    if (args.includes("nonexistent-provider.json")) {
      return { status: 0, stdout: "unexpected pass", stderr: "" };
    }
    return spawnSync(cmd, args, opts);
  };

  try {
    await assert.rejects(
      () =>
        verifyCandidate({
          siteUrl: server.origin,
          testTarball: tarball,
          execFn: mockExec,
        }),
      /Unexpected exit.*nonexistent-provider/,
    );
  } finally {
    await server.close();
  }
});

test("verifyPublished passes end-to-end against mock HTTP server with real package", async () => {
  const server = await startMockServer();
  const tarball = getCoreTarball();
  const executions = [];

  try {
    const result = await verifyCandidate({
      siteUrl: server.origin,
      testTarball: tarball,
      execFn: (cmd, args, opts) => {
        executions.push([cmd, ...args]);
        return spawnSync(cmd, args, opts);
      },
    });

    assert.equal(result.status, "passed");
    assert.equal(result.version, candidateVersion);
    assert.equal(result.siteSha, candidateIdentity.expectedSiteSha);
    assert.equal(result.results.versionEndpoint, "HTTP 200, valid schema");
    assert.equal(result.results.providerManifest, "HTTP 200, valid schema");
    assert.equal(result.results.consumerManifest, "HTTP 200, valid schema");
    assert.equal(result.results.quickstartCommand, "exit 0, compatible");
    assert.equal(result.results.docsSnippetCommand, "exit 0, compatible");
    assert.equal(result.results.negativeMissingFile, "exit 2, rejected missing path");
    assert.equal(result.results.negativeBreakingChange, "exit 1, breaking diagnostic reported");
    assert.equal(result.results.restoredVerification, "exit 0, contracts verified");
    assert.equal(result.mode, "local-test-tarball");
    assert.ok(executions.some(([cmd, first]) => cmd === "npx" && first === "--no-install"));
    assert.ok(
      executions.some(
        ([cmd, first, , script]) => cmd === "npm" && first === "run" && script === "test:contracts",
      ),
    );
  } finally {
    await server.close();
  }
});

test("CLI execution of verify-published.mjs succeeds with valid target and fails with no args", async () => {
  const server = await startMockServer();
  const tarball = getCoreTarball();

  try {
    // 1. Success execution
    const runSuccess = await runCli([
      server.origin,
      "--test-tarball",
      tarball,
      "--expected-version",
      candidateVersion,
      "--expected-site-sha",
      candidateIdentity.expectedSiteSha,
    ]);
    assert.equal(runSuccess.status, 0, runSuccess.stderr);
    const parsed = JSON.parse(runSuccess.stdout.trim());
    assert.equal(parsed.status, "passed");
    assert.equal(parsed.version, candidateVersion);

    // 2. Failure execution without arguments
    const runFail = await runCli([]);
    assert.equal(runFail.status, 1);
    assert.match(runFail.stderr, /Usage: verify-published\.mjs/);
  } finally {
    await server.close();
  }
});

test("real candidate snippet path mutation fails, then restoring the snippet passes", async () => {
  let broken = true;
  const server = await startMockServer({
    "/docs/": (req, res) => {
      const html = sitePage("docs");
      res.end(broken ? html.replaceAll("aik.provider.json", "missing-provider.json") : html);
    },
  });
  try {
    const options = { siteUrl: server.origin, testTarball: getCoreTarball() };
    await assert.rejects(
      () => verifyCandidate(options),
      /missing-provider\.json|Missing manifest path/,
    );
    broken = false;
    assert.equal((await verifyCandidate(options)).status, "passed");
  } finally {
    await server.close();
  }
});

test("successful exit with incorrect command output is rejected", async () => {
  const server = await startMockServer();
  try {
    await assert.rejects(
      () =>
        verifyCandidate({
          siteUrl: server.origin,
          testTarball: getCoreTarball(),
          execFn: (cmd, args, opts) =>
            args.includes("check") && !args.includes("nonexistent-provider.json")
              ? { status: 0, stdout: "not an AIK report", stderr: "" }
              : spawnSync(cmd, args, opts),
        }),
      /Unexpected output/,
    );
  } finally {
    await server.close();
  }
});

test("success text embedded in unexpected output is rejected", async () => {
  const server = await startMockServer();
  try {
    await assert.rejects(
      () =>
        verifyCandidate({
          siteUrl: server.origin,
          testTarball: getCoreTarball(),
          execFn: (cmd, args, opts) =>
            args.includes("check")
              ? {
                  status: 0,
                  stdout: "unexpected: AIK Check Passed: all tools compatible",
                  stderr: "",
                }
              : spawnSync(cmd, args, opts),
        }),
      /Unexpected output/,
    );
  } finally {
    await server.close();
  }
});

test("shared smoke helper still verifies package imports and all eight release scenarios", () => {
  const relativeTarball = path.relative(process.cwd(), getCoreTarball());
  assert.equal(path.isAbsolute(relativeTarball), false);
  const result = smokePackage(relativeTarball, candidateVersion);
  assert.equal(result.imports, "passed");
  assert.equal(result.cli, "passed");
  assert.equal(result.scenarios, 8);
});

test("shared consumer rejects unscoped registry packages and version ranges", () => {
  for (const source of [
    "aik",
    "aik@0.1.0",
    "@agent-interaction-kit/core@latest",
    "@agent-interaction-kit/core@^0.1.0",
  ]) {
    assert.throws(
      () => createPackageConsumer({ source, version: "0.1.0" }),
      /exact scoped npm version/,
    );
  }
});

test("installed version must match pinned expectations and candidate metadata", async () => {
  const server = await startMockServer({
    "/version.json": (req, res) =>
      res.end(
        JSON.stringify({
          version: "9.9.9",
          siteSha: candidateIdentity.expectedSiteSha,
          releaseTag: "v9.9.9",
          channel: "latest",
          experimental: false,
        }),
      ),
    "/docs/": (req, res) =>
      res.end(sitePage("docs").replaceAll(candidatePackage, "@agent-interaction-kit/core@9.9.9")),
  });
  try {
    await assert.rejects(
      () =>
        verifyCandidate({
          siteUrl: server.origin,
          testTarball: getCoreTarball(),
          expectedVersion: "9.9.9",
        }),
      /Installed version/,
    );
  } finally {
    await server.close();
  }
});

test("npm mode installs only the candidate's exact scoped version and fails on registry 404", async () => {
  const server = await startMockServer();
  let attempted = false;
  try {
    await assert.rejects(
      () =>
        verifyCandidate({
          siteUrl: server.origin,
          execFn: (cmd, args, options) => {
            attempted = true;
            assert.equal(cmd, "npm");
            assert.equal(options.shell, false);
            assert.equal(args.at(-1), candidatePackage);
            assert.ok(args.includes("--save-exact"));
            return { status: 1, stderr: "npm E404 exact version unavailable", stdout: "" };
          },
        }),
      /E404 exact version unavailable/,
    );
    assert.equal(attempted, true);
  } finally {
    await server.close();
  }
});

for (const replacement of [
  "aik@0.1.0",
  "@agent-interaction-kit/core@latest",
  "@agent-interaction-kit/core@0.1.0; touch injected",
]) {
  test(`rejects unsupported registry/install snippet: ${replacement}`, async () => {
    const server = await startMockServer({
      "/docs/": (req, res) => res.end(sitePage("docs").replaceAll(candidatePackage, replacement)),
    });
    try {
      await assert.rejects(
        () => verifyCandidate({ siteUrl: server.origin, testTarball: getCoreTarball() }),
        /Unsupported|Snippet version/,
      );
    } finally {
      await server.close();
    }
  });
}

test("expectedSiteSha rejects the wrong candidate before installing", async () => {
  const server = await startMockServer();
  try {
    await assert.rejects(
      () =>
        verifyCandidate({
          siteUrl: server.origin,
          expectedSiteSha: "d".repeat(40),
          testTarball: getCoreTarball(),
        }),
      /Site SHA mismatch/,
    );
  } finally {
    await server.close();
  }
});

for (const route of ["/version.json", "/examples/provider.json", "/examples/consumer.json"]) {
  test(`rejects HTTP 206 for ${route} before installing`, async () => {
    const server = await startMockServer();
    try {
      await assert.rejects(
        () =>
          verifyCandidate({
            siteUrl: server.origin,
            fetchFn: async (url) => {
              const response = await fetch(url);
              return new URL(url).pathname === route
                ? new Response(await response.text(), { status: 206 })
                : response;
            },
            execFn: () => {
              throw new Error("must not install after partial HTTP response");
            },
          }),
        /HTTP 206/,
      );
    } finally {
      await server.close();
    }
  });
}

for (const metadata of [
  { channel: candidateVersion.includes("-") ? "latest" : "next" },
  { experimental: !candidateVersion.includes("-") },
  { releaseTag: "v9.9.9" },
]) {
  test(`rejects inconsistent release metadata ${JSON.stringify(metadata)}`, async () => {
    const server = await startMockServer();
    try {
      await assert.rejects(
        () =>
          verifyCandidate({
            siteUrl: server.origin,
            fetchFn: async (url) => {
              const response = await fetch(url);
              return new URL(url).pathname === "/version.json"
                ? Response.json({ ...(await response.json()), ...metadata })
                : response;
            },
            execFn: () => {
              throw new Error("must not install inconsistent metadata");
            },
          }),
        /Invalid \/version.json: inconsistent/,
      );
    } finally {
      await server.close();
    }
  });
}

for (const file of [
  "../provider.json",
  "/tmp/provider.json",
  "nested/provider.json",
  "aik.provider.json;touch injected",
]) {
  test(`rejects unsafe snippet path ${file} before executing commands`, async () => {
    const server = await startMockServer({
      "/docs/": (req, res) => res.end(sitePage("docs").replaceAll("aik.provider.json", file)),
    });
    try {
      await assert.rejects(
        () =>
          verifyCandidate({
            siteUrl: server.origin,
            execFn: () => {
              throw new Error("must not execute unsafe snippets");
            },
          }),
        /Unsupported manifest path|Unsupported command/,
      );
    } finally {
      await server.close();
    }
  });
}
