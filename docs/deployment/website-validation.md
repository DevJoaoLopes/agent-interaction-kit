# Website deployment and architecture validation

## Validated architecture

The `agent-interaction-kit` website (`apps/website`) has been validated under a production-hardened, zero-secrets architecture:

- **Static Generation**: Built with Astro 7 (`astro@7.3.1`) and React 19 (`react@19.2.8`) using static output (`output: "static"`).
- **Core Integration**: The prebuild pipeline compiles `@agent-interaction-kit/core` and validates example manifests before generating production HTML and assets in `dist`. The browser bundle contains zero Node CLI or Ajv runtime code.
- **Verified Release Metadata**: Builds inject non-sensitive build metadata (`PUBLIC_AIK_VERSION`, `PUBLIC_AIK_RELEASE_TAG`, `PUBLIC_SITE_SHA`, `SITE_URL`). This metadata is exposed via the static `/version.json` endpoint and rendered in the site footer (`data-testid="release-version"`).
- **Zero-Secrets Posture**:
  - The Vercel project holds no npm publishing tokens, GitHub App private keys, or write tokens.
  - Pull request previews run without credentials and emit `noindex` headers and robots directives.
  - Production deployments use a dedicated GitHub deployment environment (`vercel-production`) with strict `contents: read` permissions and concurrency locking (`aik-site-production`).
- **Production Gating**:
  - Vercel Git auto-deployment on `main` is disabled in `apps/website/vercel.json` (`git.deploymentEnabled.main: false`).
  - Production promotions occur strictly through GitHub Actions (`deploy-website.yml`), triggered either by verified npm releases (`release.yml`) or by CI-verified website-only changes on `main` (`website-main.yml`).

---

## Multi-tier validation pipeline

Production promotion is governed by four progressive verification tiers:

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│ 1. Candidate Pre-Promote Proof                                             │
│    • vercel deploy --prebuilt --prod --skip-domain                          │
│    • scripts/docs/verify-published.mjs against candidate URL + npm release  │
│    • Playwright test suite against candidate URL (SITE_TEST_URL)            │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 2. Pre-Promotion Freshness Revalidation                                     │
│    • Live query of production /version.json immediately prior to promotion │
│    • SemVer comparison prevents version downgrades                          │
│    • Git ancestry check ensures commit descent for identical versions        │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3. Post-Promotion Public Domain Verification                                │
│    • vercel promote "$DEPLOY_URL" --yes                                     │
│    • Poll production /version.json until CDN serves new version and SHA     │
│    • Verify /, /docs/, canonical links, robots.txt, sitemap.xml             │
│    • Verify /examples/provider.json and /examples/consumer.json schemas     │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 4. Continuous Health Monitoring (Weekly Schedule)                           │
│    • .github/workflows/docs-health.yml (Mondays 09:00 UTC)                  │
│    • Validates live site metadata, doc snippets, npm package, & Playwright  │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Verified test metrics and quality gates

All test suites and static analysis gates pass deterministically across the monorepo:

| Verification Suite | Command | Metric | Status |
| --- | --- | --- | --- |
| **Core Unit & E2E Tests** | `pnpm test` | 81 tests passing (7 test files) | Passing |
| **Deployment Policy & Workflows** | `pnpm test:deploy` | 25 tests passing (2 test files) | Passing |
| **Documentation & Snippets** | `pnpm test:docs` | 56 tests passing (2 test files) | Passing |
| **Release Packaging & Verification** | `node --test scripts/release/*.test.mjs` | 39 tests passing (2 test files) | Passing |
| **Full Release Matrix** | `pnpm test:release` | 120 tests passing across release, docs, deploy | Passing |
| **Website Playwright E2E & A11y** | `pnpm test:web` | 14 tests passing across 5 viewports | Passing |
| **Code Formatting & Linting** | `pnpm check` | Biome + Prettier Astro clean (0 errors) | Passing |
| **Type Checking** | `pnpm typecheck` | TypeScript (`tsc --noEmit`) + Astro check clean | Passing |
| **Unused Dependency Analysis** | `pnpm knip` | Knip clean across all workspaces | Passing |

### Playwright browser coverage

The website test suite (`apps/website/tests/`) verifies:
- Responsive layouts at viewports 360px, 390px, 768px, 1024px, and 1440px with no horizontal overflow.
- All SVG hero artwork and typography loaded cleanly.
- Reversible interactive scroll narrative.
- Quickstart interactive tabs, keyboard navigation, and clipboard copying.
- Zero-JavaScript readability and reduced-motion static narrative fallback.
- Automated WCAG A/AA accessibility audits via Axe on `/` and `/docs/`.
- Dynamic `/version.json` schema validation and footer badge reflection.

---

## Performance measurement

Lighthouse simulation against the production build:

| Metric | Score / Value |
| --- | --- |
| **Performance** | 100 |
| **Accessibility** | 100 |
| **Largest Contentful Paint (LCP)** | 1.5 s |
| **Cumulative Layout Shift (CLS)** | 0.005 |
| **Total Blocking Time (TBT)** | 0 ms |

*Note: Laboratory metrics under standard throttling; actual field performance may vary based on CDN edge location.*

---

## Visual captures

![Desktop landing](../assets/website/desktop.png)

![Mobile landing](../assets/website/mobile.png)

---

## Operational runbook and verification references

- **Deployment Manual**: [docs/deployment/website.md](website.md)
- **Operations & Security Guide**: [docs/operations/website.md](../operations/website.md)
- **Deployment Policy Logic**: [scripts/deploy/policy.mjs](../../scripts/deploy/policy.mjs)
- **Documentation Verification Script**: [scripts/docs/verify-published.mjs](../../scripts/docs/verify-published.mjs)
- **Reusable Deployment Workflow**: [.github/workflows/deploy-website.yml](../../.github/workflows/deploy-website.yml)
- **Website Main Promotion Workflow**: [.github/workflows/website-main.yml](../../.github/workflows/website-main.yml)
- **Docs Health Workflow**: [.github/workflows/docs-health.yml](../../.github/workflows/docs-health.yml)
