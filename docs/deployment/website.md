# Website deployment

## Local

Use Node 24 and pnpm 10.26.1. From the repository root:

```sh
pnpm install --frozen-lockfile
pnpm dev:web
```

`pnpm build:web` builds the core first, validates the website examples against it, then generates `apps/website/dist`. The browser never receives the Node CLI or Ajv. `pnpm test:web` tests that production output, so build first. The core remains independently buildable on Node 20.

## Vercel

Import `DevJoaoLopes/agent-interaction-kit` in the intended Vercel account/team:

| Setting | Value |
| --- | --- |
| Framework | Astro |
| Root Directory | `apps/website` |
| Node | 24.x |
| Install | `pnpm install --frozen-lockfile` |
| Build | `pnpm build` (website script; prebuild builds core) |
| Output | `dist` |
| Production branch | `main` |

Enable inclusion of workspace files outside the Root Directory if prompted. Vercel must see the root lockfile and `packages/core`. PR branches produce previews through the Git integration. Neither root nor website is publishable to npm.

Production origin: set `SITE_URL` to the exact HTTPS production origin, without a path. Otherwise the build uses `VERCEL_PROJECT_PRODUCTION_URL` only for production. Preview and local builds emit `noindex` and disallow crawling; no fake canonical is generated. A preview can use the production `SITE_URL` as canonical while remaining noindex. Check `/`, `/docs/`, `/robots.txt`, `/sitemap.xml`, metadata and image URLs on the deployed preview/production build.

Initially use the URL Vercel assigns (`*.vercel.app`). No custom domain has been purchased. `agentinteractionkit.dev` is a candidate only. After choosing and registering a name, add the apex domain in Vercel and use the exact DNS records supplied by its dashboard. Add `www` as a redirect to the apex. Update `SITE_URL`, rebuild and verify HTTPS, redirects, canonical and sitemap.

Never commit credentials, `.env` or `.vercel`. Connecting a Vercel account is an external setup step if credentials are not available. Do not merge the implementation PR or trigger a production promotion as part of preview validation.

## Integration with the other open PRs

This branch starts at `e0b67f4`; PRs #7–#11 were open at implementation time and were not merged here. After they land, reconcile:

- #7 Dependabot: keep the root lockfile; cover workspace manifests and GitHub Actions.
- #8 parser/schema safety: changes move to `packages/core/src` and `packages/core/tests`.
- #9 Knip: configure workspaces and Astro/React entrypoints; retain core analysis.
- #10 release: publish only `packages/core`; keep its README/LICENSE and metadata. Never publish the workspace root.
- #11 CI: preserve its core Node/OS matrix and commit conventions; keep the website on Node 24.

## Packaging

Build with `pnpm build:core`, then `pnpm --filter @agent-interaction-kit/core pack --pack-destination <directory>`. Inspect the tarball before release: no website, fixtures or tests. This PR changes layout, not the core's API, package name, version or CLI behavior.
