import assert from "node:assert/strict";
import { existsSync, readFileSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { channelFor } from "../release/policy.mjs";
import { createPackageConsumer } from "../release/smoke-package.mjs";
import { parseSnippets } from "./snippets.mjs";

export async function verifyPublished(options = {}) {
  const { siteUrl, expectedVersion, expectedSiteSha, testTarball } = options;
  const fetchFn = options.fetchFn ?? globalThis.fetch;

  if (!siteUrl) {
    throw new Error(
      "Usage: verify-published.mjs <site-url> --expected-version <version> --expected-site-sha <40-hex-sha> [--test-tarball <absolute-path.tgz>]",
    );
  }

  let base;
  try {
    base = new URL(siteUrl);
    if (!/^https?:$/.test(base.protocol)) {
      throw new Error(`Invalid protocol '${base.protocol}'; http or https required`);
    }
  } catch (err) {
    throw new Error(`Invalid site URL '${siteUrl}': ${err.message}`);
  }

  assert.equal(
    typeof expectedVersion,
    "string",
    "Invalid expectedVersion: exact release version required",
  );
  try {
    channelFor(expectedVersion);
  } catch {
    throw new Error("Invalid expectedVersion: exact supported release version required");
  }
  assert.ok(
    typeof expectedSiteSha === "string" && /^[a-fA-F0-9]{40}$/.test(expectedSiteSha),
    "Invalid expectedSiteSha: full 40-character hexadecimal Git SHA required",
  );

  assert.equal(
    options.packageTarget,
    undefined,
    "Unsupported packageTarget; use --test-tarball explicitly for local tests",
  );
  if (testTarball !== undefined) {
    assert.ok(
      typeof testTarball === "string" && path.isAbsolute(testTarball),
      "Test tarball must be an absolute path",
    );
    assert.ok(testTarball.endsWith(".tgz"), "Test package must be a local .tgz tarball");
    assert.ok(existsSync(testTarball), `Package tarball does not exist: ${testTarball}`);
    assert.ok(statSync(testTarball).isFile(), "Test tarball must be a file");
  }

  // 1. Download and verify /version.json
  const versionUrl = new URL("/version.json", base);
  const versionRes = await fetchFn(versionUrl.toString());
  if (versionRes.status !== 200) {
    throw new Error(`Failed to fetch /version.json from ${versionUrl}: HTTP ${versionRes.status}`);
  }

  let versionInfo;
  try {
    versionInfo = await versionRes.json();
  } catch (err) {
    throw new Error(`Malformed JSON in /version.json from ${versionUrl}: ${err.message}`);
  }

  if (!versionInfo || typeof versionInfo !== "object") {
    throw new Error("Invalid /version.json: root must be an object");
  }
  if (
    !versionInfo.version ||
    typeof versionInfo.version !== "string" ||
    versionInfo.version.trim() === ""
  ) {
    throw new Error("Invalid /version.json: missing or empty 'version'");
  }
  if (!versionInfo.siteSha || typeof versionInfo.siteSha !== "string") {
    throw new Error("Invalid /version.json: missing or invalid 'siteSha'");
  }
  if (!versionInfo.channel || typeof versionInfo.channel !== "string") {
    throw new Error("Invalid /version.json: missing or invalid 'channel'");
  }
  if (typeof versionInfo.experimental !== "boolean") {
    throw new Error("Invalid /version.json: missing or invalid 'experimental'");
  }
  if (typeof versionInfo.releaseTag !== "string") {
    throw new Error("Invalid /version.json: missing or invalid 'releaseTag'");
  }

  if (versionInfo.version !== expectedVersion) {
    throw new Error(
      `Version mismatch: expected '${expectedVersion}', but site reports '${versionInfo.version}'`,
    );
  }
  const channel = channelFor(versionInfo.version);
  assert.equal(versionInfo.channel, channel, "Invalid /version.json: inconsistent channel");
  assert.equal(
    versionInfo.experimental,
    channel === "next",
    "Invalid /version.json: inconsistent experimental flag",
  );
  assert.equal(
    versionInfo.releaseTag,
    `v${versionInfo.version}`,
    "Invalid /version.json: inconsistent releaseTag",
  );
  assert.ok(versionInfo.siteSha.trim(), "Invalid /version.json: empty siteSha");
  assert.equal(versionInfo.siteSha, expectedSiteSha, "Site SHA mismatch");

  // 2. Download and verify public manifests
  const providerUrl = new URL("/examples/provider.json", base);
  const providerRes = await fetchFn(providerUrl.toString());
  if (providerRes.status !== 200) {
    throw new Error(
      `Failed to fetch /examples/provider.json from ${providerUrl}: HTTP ${providerRes.status}`,
    );
  }

  let providerText;
  let providerData;
  try {
    providerText = await providerRes.text();
    providerData = JSON.parse(providerText);
  } catch (err) {
    throw new Error(`Malformed JSON in /examples/provider.json: ${err.message}`);
  }
  if (!providerData || !providerData.schemaVersion || !Array.isArray(providerData.tools)) {
    throw new Error("Invalid provider manifest schema in /examples/provider.json");
  }

  const consumerUrl = new URL("/examples/consumer.json", base);
  const consumerRes = await fetchFn(consumerUrl.toString());
  if (consumerRes.status !== 200) {
    throw new Error(
      `Failed to fetch /examples/consumer.json from ${consumerUrl}: HTTP ${consumerRes.status}`,
    );
  }

  let consumerText;
  let consumerData;
  try {
    consumerText = await consumerRes.text();
    consumerData = JSON.parse(consumerText);
  } catch (err) {
    throw new Error(`Malformed JSON in /examples/consumer.json: ${err.message}`);
  }
  if (!consumerData || !consumerData.schemaVersion || !Array.isArray(consumerData.requires)) {
    throw new Error("Invalid consumer manifest schema in /examples/consumer.json");
  }

  const pages = await Promise.all(
    ["/", "/docs/"].map(async (route) => {
      const response = await fetchFn(new URL(route, base).toString());
      assert.equal(response.status, 200, `Failed to fetch ${route}: HTTP ${response.status}`);
      return response.text();
    }),
  );
  const commands = parseSnippets(pages[1], versionInfo.version);
  const packageSource = testTarball
    ? path.resolve(testTarball)
    : `@agent-interaction-kit/core@${versionInfo.version}`;
  const { cwd, run, cli, cleanup } = createPackageConsumer({
    source: packageSource,
    version: versionInfo.version,
    execFn: options.execFn,
  });
  const check = (
    args,
    code = 0,
    output = /^✔ AIK Check Passed: all tools compatible \(context: "[^"\r\n]+"\)\r?\n {2}Producer Build: [^\r\n]+ \| Consumer Build: [^\r\n]+\r?\n\r?\nSummary: [1-9]\d* tools checked, 0 diagnostics\.$/,
    result = cli(args),
  ) => {
    assert.equal(
      result.status,
      code,
      `Unexpected exit for ${args.join(" ")}: ${result.stderr || result.stdout}`,
    );
    assert.match(
      (code === 0 ? result.stdout : result.stdout + result.stderr).trim(),
      output,
      `Unexpected output for ${args.join(" ")}`,
    );
  };
  try {
    // These are the public download filenames, not copies fabricated for arbitrary snippet paths.
    writeFileSync(path.join(cwd, "aik.provider.json"), providerText);
    writeFileSync(path.join(cwd, "aik.consumer.json"), consumerText);
    const packageFile = path.join(cwd, "package.json");
    const pkg = JSON.parse(readFileSync(packageFile, "utf8"));
    // Only tokens accepted by the grammar reach this npm script, never raw HTML.
    pkg.scripts = { "test:contracts": ["aik", ...commands.at(-1).args].join(" ") };
    writeFileSync(packageFile, JSON.stringify(pkg));
    const runScript = () => run("npm", ["run", "--silent", "test:contracts"]);
    for (const { id, args } of commands) {
      for (const file of [args[2], args[4]]) {
        assert.ok(existsSync(path.join(cwd, file)), `Missing manifest path: ${file}`);
      }
      const result =
        id === "docs-script"
          ? runScript()
          : id === "docs-dlx" && !testTarball
            ? run("pnpm", ["dlx", packageSource, ...args])
            : run("npx", ["--no-install", "aik", ...args]);
      check(args, undefined, undefined, result);
    }
    // The CI snippet is allowlisted, not executed as YAML or a remote npm script.
    const ci = run("npm", ["ci", "--ignore-scripts", "--no-audit", "--no-fund"]);
    assert.equal(ci.status, 0, ci.stderr);
    check(commands.at(-1).args, undefined, undefined, runScript());
    const args = commands[0].args;
    const missingArgs = [...args];
    missingArgs[2] = "nonexistent-provider.json";
    check(missingArgs, 2, /nonexistent-provider\.json/);

    // Rename the field described by the docs and require that exact diagnostic.
    const brokenProvider = JSON.parse(providerText);
    const schema = brokenProvider.tools[0]?.returns?.schema;
    assert.ok(
      schema?.properties?.total && schema.required?.includes("total"),
      "Public provider must demonstrate the documented total field",
    );
    const { total, ...remaining } = schema.properties;
    schema.properties = { ...remaining, amount: total };
    schema.required = schema.required.map((key) => (key === "total" ? "amount" : key));
    writeFileSync(path.join(cwd, args[2]), JSON.stringify(brokenProvider));
    check(args, 1, /AIK-RESULT-002/);
    writeFileSync(path.join(cwd, args[2]), providerText);
    check(args);
    return {
      status: "passed",
      siteUrl: base.origin,
      version: versionInfo.version,
      siteSha: versionInfo.siteSha,
      packageSource,
      mode: testTarball ? "local-test-tarball" : "npm-exact",
      commands,
      substitutions: testTarball
        ? ["docs-dlx: npx --no-install uses the test tarball instead of fetching from npm"]
        : [],
      results: {
        versionEndpoint: "HTTP 200, valid schema",
        providerManifest: "HTTP 200, valid schema",
        consumerManifest: "HTTP 200, valid schema",
        quickstartCommand: "exit 0, compatible",
        docsSnippetCommand: "exit 0, compatible",
        negativeMissingFile: "exit 2, rejected missing path",
        negativeBreakingChange: "exit 1, breaking diagnostic reported",
        restoredVerification: "exit 0, contracts verified",
      },
    };
  } finally {
    cleanup();
  }
}

const isCli =
  Boolean(process.argv[1]) && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isCli) {
  try {
    const [siteUrl, ...flags] = process.argv.slice(2);
    const options = { siteUrl };
    const names = {
      "--expected-version": "expectedVersion",
      "--expected-site-sha": "expectedSiteSha",
      "--test-tarball": "testTarball",
    };
    for (let i = 0; i < flags.length; i += 2) {
      const name = names[flags[i]];
      assert.ok(
        name && flags[i + 1] && !flags[i + 1].startsWith("--") && options[name] === undefined,
        `Invalid or duplicate option: ${flags[i]}`,
      );
      options[name] = flags[i + 1];
    }
    const result = await verifyPublished(options);
    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    console.error(`Verification failed: ${error.message}`);
    process.exit(1);
  }
}
