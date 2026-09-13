# Candidate documentation verification

## CLI for deploy and health callers

```sh
node scripts/docs/verify-published.mjs "$SITE_TEST_URL" \
  --expected-version "$PUBLIC_AIK_VERSION" \
  --expected-site-sha "$PUBLIC_SITE_SHA"
```

The URL and **both expectations are required**. `expectedVersion` must be an exact
supported release version (stable `X.Y.Z` or `X.Y.Z-beta.N`, with positive `N`),
and `expectedSiteSha` must be a full 40-character hexadecimal Git SHA. Missing,
blank, non-string, and invalid expectations fail **before any HTTP request**.
Deploy and future health callers must independently resolve a validated
publication/version and the expected site SHA before calling; the candidate's
`/version.json` is compared against those inputs, never used to choose them.
The verifier checks HTTP 200 and
JSON, release metadata consistency, and the actual public manifests and marked
documentation snippets. Missing/unreleased versions fail.

By default it installs **only** `@agent-interaction-kit/core@<site version>` in a
temporary consumer, checks the installed package identity and CLI version, and
executes the documented checks with `--strict`. An unavailable npm version is a
failure; it never falls back to the workspace, a dist-tag, or the registry package
`aik`.

CLI success exits 0 and prints a JSON report to stdout; failure exits 1 and prints
a diagnostic to stderr. Unknown, duplicate, and valueless flags fail.

### Explicit local package testing

```sh
node scripts/docs/verify-published.mjs "$SITE_TEST_URL" \
  --expected-version "$PUBLIC_AIK_VERSION" \
  --expected-site-sha "$PUBLIC_SITE_SHA" \
  --test-tarball /absolute/path/to/core-candidate.tgz
```

This requires an existing local `.tgz` with an **absolute path** and the same
version as the candidate. Relative paths are rejected before resolution or HTTP.
The report uses `mode: "local-test-tarball"` and records the substitution of
`pnpm dlx` with `npx --no-install` against that installed tarball. This mode proves
local candidate compatibility, **not npm publication or public deployment**.
Production callers must require `mode: "npm-exact"`; this documentation smoke
does not replace release integrity checks or authorize promotion.

## API

`verify-published.mjs` exports:

```js
await verifyPublished({ siteUrl, expectedVersion, expectedSiteSha, testTarball });
```

`siteUrl`, `expectedVersion`, and `expectedSiteSha` are mandatory; `testTarball`
remains optional and requires an absolute path when supplied.
It resolves to the same report as the CLI or rejects on failure. Reports include
`status`, `siteUrl`, `version`, `siteSha`, `packageSource`, `mode`, parsed `commands`,
`substitutions`, and scenario `results`. Optional `fetchFn` and `execFn` are test
seams; normal callers use the real HTTP and process implementations.

`snippets.mjs` exports `snippet(html, id)` and `parseSnippets(docs, version)`.
The parser accepts a narrow command grammar and returns argument arrays. It
rejects shell operators, unexpected commands/packages, unsafe paths, and missing
`--strict`. Remote HTML and YAML are never passed to a shell. The npm script is
reconstructed from validated tokens; the CI sequence is allowlisted. Package
installation and `npm ci` disable lifecycle scripts.

The shared `scripts/release/smoke-package.mjs` exports
`createPackageConsumer({ source, version, execFn })`, returning
`{ cwd, run, cli, cleanup }`, and `smokePackage(source, expectedVersion)`.
Consumer owners must call `cleanup()` in `finally`; the documentation verifier
does this on both success and failure. The existing positional smoke CLI remains
available, including support for relative local tarball paths. The absolute-path
requirement applies to the docs verifier API/CLI, not the shared smoke helper.

## Tests

- `pnpm test:docs` builds the real website with explicit **test** metadata,
  serves its generated pages/manifests over loopback HTTP, and installs an
  explicitly packed test tarball. It includes a wrong snippet path followed by
  the restored positive case, exact-version/404 checks, invalid HTTP/JSON,
  unexpected output/exit codes, and release-smoke regression coverage.
- `pnpm test:release` includes the docs tests.
- After building the website, `pnpm test:web` uses Playwright's local preview.
  Setting `SITE_TEST_URL` instead disables `webServer` and targets that URL for
  the whole browser suite, including no-JS. Set `PUBLIC_AIK_VERSION` and
  `PUBLIC_SITE_SHA` to assert candidate identity. Without those expectations,
  remote mode validates the served metadata; local mode expects `unreleased`
  and `local`.

Only local candidate/tarball evidence is supplied by these automated tests.
The npm 404 failure is simulated to test fail-closed behavior; it is not a live
registry observation.
