import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { runCli } from "./test-candidate.mjs";
import { verifyPublished } from "./verify-published.mjs";

const identity = { expectedVersion: "0.1.0", expectedSiteSha: "abcd1234".repeat(5) };
const directory = mkdtempSync(path.join(os.tmpdir(), "aik-docs-inputs-"));
const tarball = path.join(directory, "candidate.tgz");
writeFileSync(tarball, "Input validation must reject this path before reading or installing it.");
test.after(() => rmSync(directory, { recursive: true, force: true }));

for (const [field, values] of Object.entries({
  expectedVersion: [
    undefined,
    null,
    "",
    " ",
    1,
    "latest",
    "^0.1.0",
    "unreleased",
    "0.1.0 ",
    "0.1.0\n",
    "aik@0.1.0",
  ],
  expectedSiteSha: [
    undefined,
    null,
    "",
    " ",
    1,
    "local",
    "abcd1234",
    "g".repeat(40),
    "a".repeat(39),
    "a".repeat(41),
    `${"a".repeat(40)}\n`,
  ],
})) {
  for (const value of values) {
    test(`API rejects invalid ${field}=${JSON.stringify(value)} before fetch`, async () => {
      let fetched = false;
      await assert.rejects(
        () =>
          verifyPublished({
            siteUrl: "https://candidate.example",
            ...identity,
            [field]: value,
            fetchFn: () => {
              fetched = true;
              throw new Error("unexpected fetch");
            },
          }),
        new RegExp(`Invalid ${field}`),
      );
      assert.equal(fetched, false);
    });
  }
}

test("API rejects an existing relative test tarball before fetch", async () => {
  const relative = path.relative(process.cwd(), tarball);
  assert.equal(path.isAbsolute(relative), false);
  let fetched = false;
  await assert.rejects(
    () =>
      verifyPublished({
        siteUrl: "https://candidate.example",
        ...identity,
        testTarball: relative,
        fetchFn: () => {
          fetched = true;
          throw new Error("unexpected fetch");
        },
      }),
    /Test tarball must be an absolute path/,
  );
  assert.equal(fetched, false);
});

test("CLI rejects missing or invalid expectations and relative tarballs before HTTP", async () => {
  let requests = 0;
  const server = http.createServer((req, res) => {
    requests++;
    res.writeHead(500);
    res.end();
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const url = `http://127.0.0.1:${server.address().port}`;
  const version = ["--expected-version", identity.expectedVersion];
  const sha = ["--expected-site-sha", identity.expectedSiteSha];
  try {
    for (const [flags, error] of [
      [[], /Invalid expectedVersion/],
      [sha, /Invalid expectedVersion/],
      [version, /Invalid expectedSiteSha/],
      [[...sha, "--expected-version", " "], /Invalid expectedVersion/],
      [[...sha, "--expected-version", "latest"], /Invalid expectedVersion/],
      [[...version, "--expected-site-sha", " "], /Invalid expectedSiteSha/],
      [[...version, "--expected-site-sha", "local"], /Invalid expectedSiteSha/],
      [
        [...version, ...sha, "--test-tarball", path.relative(process.cwd(), tarball)],
        /Test tarball must be an absolute path/,
      ],
    ]) {
      const result = await runCli([url, ...flags]);
      assert.equal(result.status, 1);
      assert.match(result.stderr, error);
      assert.equal(requests, 0, "Invalid CLI inputs must not contact the candidate");
    }
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
