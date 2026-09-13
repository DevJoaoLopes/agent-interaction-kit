# Vercel Website and Usable Documentation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Publicar o website na Vercel com previews, versões documentadas verificadas e um onboarding que funciona fora do monorepo.

**Architecture:** Vercel Git Integration fornece previews; somente um workflow reutilizável promove produção. Releases usam publication.json verificado; website-only usa uma publicação já verificada e CI aprovada. Conteúdo público identifica separadamente SHA do site e versão npm.

**Tech Stack:** Astro estático, React, Playwright/Axe, Vercel CLI, GitHub Actions, npm registry.

---

## Arquivos e interfaces

- Criar `apps/website/vercel.json`: Git auto-deploy main desativado, previews mantidos.
- Criar `apps/website/src/lib/release-info.ts`: metadados públicos de build.
- Criar `apps/website/src/pages/version.json.ts`: endpoint estático de rastreabilidade.
- Modificar `apps/website/src/layouts/Layout.astro`: versão/canal visíveis.
- Modificar `apps/website/src/components/landing/Quickstart.tsx`, `src/pages/docs/index.astro` e seu ponto de uso em `src/pages/index.astro`.
- Modificar `README.md`, `packages/core/README.md`, `skills/generate-contracts/SKILL.md`: comandos corretos; a skill só precisa de ajuste documental dos comandos, não novo comportamento.
- Modificar `apps/website/playwright.config.ts`; criar `apps/website/tests/published.spec.ts`.
- Criar `scripts/deploy/policy.mjs`, `policy.test.mjs`, `scripts/docs/verify-published.mjs`.
- Criar `.github/workflows/deploy-website.yml`, `.github/workflows/website-main.yml`, `.github/workflows/docs-health.yml`.
- Atualizar `docs/deployment/website.md`, `website-validation.md`; criar `docs/operations/website.md`.

Entradas do promotor: `site-sha`, `release-tag`, `package-version`, `reason` (`release`, `website`, `recovery`). Fonte da versão é publication.json de uma GitHub Release validada, conferida no registry; não confiar em input livre ou package.json ainda não publicado.

## Task 1: Projeto Vercel e hostname

- [ ] Concluir a atribuição autenticada de `agent-interaction-kit.vercel.app`. Registrar URL aceita, project ID, org/team ID; 404 anterior não é evidência suficiente. Se indisponível, pausar apenas essa tarefa para o mantenedor escolher outro hostname.
- [ ] Importar o repositório na Vercel, root directory `apps/website`, framework Astro, Node 24, incluir arquivos fora do root para workspace. Build command `pnpm build`, output `dist`; o prebuild existente compila o core e valida exemplos. Usar lockfile da raiz e instalação frozen do workspace.
- [ ] Criar `apps/website/vercel.json`:

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "git": {"deploymentEnabled": {"main": false}}
}
```

O arquivo está no root configurado do projeto Vercel. Não acrescentar `"*": true`, que pode reativar main pela regra de match. Confirmar funcionalmente: PR cria preview; merge main não atribui produção automaticamente.
- [ ] Guardar Vercel token em `vercel-production`; project/org IDs e `SITE_URL` em variáveis. Git Integration de preview não precisa desse token. Não copiar envs do Agamenon, App ou npm para a Vercel.
- [ ] Validar plano Vercel adequado ao uso pessoal não comercial e limites. Compra de domínio próprio está explicitamente fora desta entrega.

## Task 2: Mostrar a versão efetivamente publicada

- [ ] Criar teste Playwright exigindo `/version.json` com os valores de build e badge beta; observar falha antes de implementar. Usar em CI valores de teste conhecidos, não consultas online obrigatórias em toda PR.
- [ ] Implementar `release-info.ts` com os dados públicos (esses valores não são secrets):

```typescript
const version = import.meta.env.PUBLIC_AIK_VERSION || "unreleased";
const production = import.meta.env.VERCEL_ENV === "production";
const siteSha = import.meta.env.PUBLIC_SITE_SHA || "local";
const releaseTag = import.meta.env.PUBLIC_AIK_RELEASE_TAG || "";
const channel = version.includes("-beta.") ? "next" : "latest";
if (production && (version === "unreleased" || siteSha === "local" || releaseTag !== `v${version}`)) {
  throw new Error("Production requires verified release and source metadata");
}
export const releaseInfo = { version, channel, releaseTag, siteSha, experimental: channel === "next" };
```

Metadados sintáticos não bastam: o workflow ainda deve verificar publication.json, integridade e existência no npm. Em preview sem versão disponível, apresentar `unreleased`/instrução de preview, não um comando que promete pacote inexistente.
- [ ] Criar endpoint `version.json.ts`:

```typescript
import { releaseInfo } from "../lib/release-info";
export function GET() {
  return new Response(JSON.stringify(releaseInfo), {
    headers: { "Content-Type": "application/json" },
  });
}
```

- [ ] No Layout, importar `releaseInfo` e renderizar perto do footer:

```astro
<p data-testid="release-version">
  {releaseInfo.experimental ? "Experimental beta" : "Version"}: {releaseInfo.version}
</p>
```

Preservar canonical e noindex existentes; produção precisa de `SITE_URL` e `VERCEL_ENV=production`; preview deve continuar noindex.
- [ ] Rodar typecheck/build e testes do website com envs públicos explícitos. Confirmar que um build de produção sem metadados falha, enquanto o dev local permanece utilizável.

## Task 3: Quickstart para consumidores

- [ ] Em `Quickstart.tsx`, substituir constantes de clone/build por props `version` e comandos de instalação. O caller Astro passa `releaseInfo.version`; não importar envs de servidor em uma island esperando que sejam resolvidos em runtime no browser.

```typescript
export default function Quickstart({ version }: { version: string }) {
  const install = `npm install --save-dev --save-exact @agent-interaction-kit/core@${version}`;
  const check = "npx --no-install aik check \\\n  --provider aik.provider.json \\\n  --consumer aik.consumer.json --strict";
  // Manter o JSX e o comportamento de tabs/clipboard existentes,
  // alterando o label da primeira tab para "1. Install".
}
```

Quando `version === "unreleased"`, mostrar instruções de preview/desenvolvimento separadas e não renderizar esse comando com versão inválida. O código acima define somente a mudança no corpo existente, não é substituição do componente por um stub.
- [ ] Nos READMEs/site, usar o mesmo onboarding público:

```bash
npm install --save-dev --save-exact @agent-interaction-kit/core@1.0.0-beta.1
npx --no-install aik check --provider aik.provider.json --consumer aik.consumer.json --strict
```

```json
{
  "scripts": {
    "test:contracts": "aik check --provider aik.provider.json --consumer aik.consumer.json --strict"
  }
}
```

```bash
npm run test:contracts
```

O exemplo fixa a primeira beta; na documentação gerada do site usar a versão validada do build. Após promoção, revisar READMEs no PR estável e remover a recomendação de beta como default. Não atualizar README automaticamente a partir de código ainda não publicado sem rotular como release candidata.
- [ ] Documentar execução avulsa separadamente:

```bash
pnpm dlx @agent-interaction-kit/core@1.0.0-beta.1 check \
  --provider aik.provider.json --consumer aik.consumer.json --strict
```

- [ ] Incluir dois manifests mínimos completos a partir do fixture `packages/core/fixtures/valid`, links de download já existentes e instruções para mapear tools reais. Explicar que salvar exemplos prova setup, mas adaptar/exportar schemas é necessário para proteger a aplicação. Linkar a skill como auxílio opcional e o exemplo Agamenon após sua validação, sem prometer geração automática.
- [ ] Explicar códigos de saída em tabela e mostrar snippet CI com instalação frozen e `test:contracts`. Separar erro de entrada de inconclusivo embora ambos saiam 2. Manter clone/build em CONTRIBUTING.
- [ ] Corrigir ocorrências de `npx aik` sem instalação prévia nos READMEs e na skill existente; não reescrever as instruções comportamentais da skill nesta tarefa.
- [ ] Revisão editorial: alguém sem contexto consegue descobrir o que instalar, onde criar os manifests, o que o comando compara e como agir ao falhar? Remover texto “release in preparation” apenas quando a publicação já tiver sido confirmada.

## Task 4: Testes da documentação e do site remoto

- [ ] Alterar Playwright config para aceitar alvo remoto sem iniciar servidor local:

```typescript
const remote = process.env.SITE_TEST_URL;
// Dentro de defineConfig, manter os demais campos:
// use.baseURL = remote || "http://127.0.0.1:4322"
// webServer = remote ? undefined : configuração local atual
```

- [ ] Criar `tests/published.spec.ts` com verificações reais:

```typescript
import { expect, test } from "@playwright/test";

test("serves documented release metadata and usable pages", async ({ page, request }) => {
  const response = await request.get("/version.json");
  expect(response.ok()).toBeTruthy();
  const info = await response.json();
  expect(info.version).toBe(process.env.PUBLIC_AIK_VERSION || "unreleased");
  expect(info.siteSha).toBe(process.env.PUBLIC_SITE_SHA || "local");
  await page.goto("/");
  await expect(page.getByTestId("release-version")).toContainText(info.version);
  await page.goto("/docs/");
  await expect(page.locator("main")).toContainText("--strict");
});
```

- [ ] `scripts/docs/verify-published.mjs` deve baixar os dois manifests públicos do candidato, verificar HTTP/JSON e rodar os comandos documentados numa instalação temporária da versão exata. Reutilizar o smoke-package do plano npm para instalação/CLI e acrescentar cenários dos snippets reais (não apenas fixtures diferentes). Rejeitar comando com pacote `aik` no registry, caminhos inexistentes, output/code inesperados e versão ausente.
- [ ] Comprovar teste negativo mudando temporariamente um path do snippet: o check deve falhar; restaurar e obter verde. Não considerar teste de clipboard equivalente a executar o comando copiado.
- [ ] Manter testes Axe, mobile, teclado, reduced motion e no-JS existentes. Rodar smoke público mínimo após deploy; teste completo de browser roda no candidato antes de atribuir domínio.

## Task 5: Política de deploy testável

- [ ] Criar testes puros de `scripts/deploy/policy.mjs` para estes casos:

| Entrada | Decisão |
| --- | --- |
| CI de PR/fork ou falha | não publicar produção |
| commit website-only, CI success, publicação verificada | candidato website |
| commit misto core+website | aguardar release, sem publicar documentação nova automaticamente |
| lockfile sem análise do impacto nos importers | não classificar automaticamente website-only |
| release validada, sem estável existente | publicar beta |
| beta posterior, estável já promovida | não substituir recomendação estável |
| candidato anterior ao site promovido | não promover; reconciliar candidato atual |
| retry de deploy da mesma versão e SHA | permitir verificação/reexecução sem npm publish |

- [ ] Implementar o classificador website-only com allowlist inicial `apps/website/` e `docs/deployment/`. Mudanças na raiz/shared/workflows não entram automaticamente; só liberar um lockfile se os importers e resolução do core permanecerem iguais. Isto é deliberadamente conservador, sem bloquear a CI dos PRs.
- [ ] Selecionar a publicação por assets `publication.json` das Releases: preferir a estável verificada mais recente; na ausência de estável, beta verificada mais recente. Usar comparação SemVer, não ordenação lexical ou data da última edição. Conferir versão e integridade no npm. Não usar `npm latest` como única fonte, pois pode apontar para publicação cujo smoke falhou.
- [ ] Implementar um promotor único com lock de produção e revalidação imediatamente antes de `vercel promote`: conferir versão escolhida, metadata atual do site e ancestralidade Git. Runs atrasados não rebaixam site/pacote. Um SHA de release antigo diante de website mais novo gera reconciliação do site atual usando a nova versão publicada, após CI/exemplos passarem.

## Task 6: Workflow de produção e provas na Vercel

- [ ] Criar `.github/workflows/deploy-website.yml` reutilizável (`workflow_call` com quatro inputs definidos no mapa) e recuperação manual na main. Job usa environment `vercel-production`, `contents: read`, sem OIDC/npm/App secrets, `concurrency: {group: aik-site-production, cancel-in-progress: false}`.
- [ ] Todos os callers passam SHA/tag/versão verificados, e o reusable valida novamente. Checkout exato, sem credenciais persistidas; usar Node 24, pnpm frozen e Vercel CLI exata em devDependency da raiz. Resolver versão na execução, registrar lockfile e usar `pnpm exec vercel`, não `latest` em cada deploy.
- [ ] No diretório raiz do monorepo, linkar projeto com IDs e executar:

```bash
pnpm exec vercel pull --yes --environment=production --token "$VERCEL_TOKEN"
pnpm exec vercel build --prod --token "$VERCEL_TOKEN"
pnpm exec vercel deploy --prebuilt --prod --skip-domain --token "$VERCEL_TOKEN"
```

Exportar `PUBLIC_AIK_VERSION`, `PUBLIC_AIK_RELEASE_TAG`, `PUBLIC_SITE_SHA`, `SITE_URL`, `VERCEL_ENV=production` antes do build. Confirmar onde `.vercel/output` foi gerado com rootDirectory configurado; não mover artefatos cegamente. O deploy deve usar o build já validado.
- [ ] Capturar URL retornada pelo deploy como output e rodar smoke/exemplos/browser nessa URL. Se deployment protection impedir acesso automático, usar mecanismo de bypass da Vercel restrito ao teste ou acesso via CLI autenticado; não desativar proteção de todas as previews sem necessidade. Nunca publicar bypass secret no site.
- [ ] Após revalidar política de frescor, executar `pnpm exec vercel promote "$DEPLOYMENT_URL" --yes --token "$VERCEL_TOKEN"`. Conferir hostname público, `/`, `/docs/`, JSON de exemplos, `/version.json`, canonical, sitemap, robots e assets sem 404. A URL de candidato não substitui a verificação do domínio público.
- [ ] Conectar job de release como caller somente após `publication.json` ser produzido; se bootstrap ainda pendente, não chamar deploy.
- [ ] Criar `.github/workflows/website-main.yml` em `workflow_run` da `CI Matrix`, filtrando `event == push`, `head_branch == main`, repo correto, `conclusion == success`. O workflow privilegiado não executa código de PR/fork. Classificar arquivos do commit/squash testado e chamar promotor apenas para website-only. Processar atrasos pela política de frescor, não assumir FIFO.
- [ ] Criar PR real de texto no site: preview disponível, checks aprovados, merge → novo SHA público e mesma versão npm; provar que não surgiu release PR/npm por causa desse commit.
- [ ] Introduzir falha de smoke numa execução de teste antes de promover; confirmar que domínio público continua no deployment anterior. Reexecutar somente deploy após corrigir. Registrar rollback para URL anterior com metadata correspondente; rollback explícito é exceção manual à regra de frescor, nunca retag npm.

## Task 7: Saúde contínua das docs

- [ ] Criar `docs-health.yml` com `workflow_dispatch` e schedule semanal (segunda 09:00 UTC), permissions leitura. Consultar site público/metadata, instalar versão exata e executar exemplos. Em falha, deixar run vermelho e notificação do GitHub; não conceder issues write só para abrir issues repetitivas.
- [ ] Rodar os mesmos checks de exemplos/documentação em PRs que alteram comandos. Tests de PR usam tarball candidato para validar distribuição; production gate usa npm publicado. Não colocar disponibilidade do registry/site como bloqueador de toda PR puramente local.
- [ ] Atualizar docs de deployment removendo a orientação antiga de produção automática a cada main sem gate e a afirmação de que PRs #7–#11 ainda estão abertos.
- [ ] Registrar evidências em `docs/deployment/website-validation.md`: URL real, versão, SHA, workflow, testes executados e resultado; não reciclar resultados históricos como se fossem atuais.
- [ ] Gate: previews, release deploy, website-only deploy, smoke negativo sem promoção e recuperação demonstrados; documentação de consumidor revisada e executada.
