# npm Release and Distribution Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Publicar um pacote realmente consumível via release PR, beta/next, bootstrap verificável e OIDC recorrente.

**Architecture:** release-please gerencia somente `packages/core`. Um único workflow `release.yml` coordena tag, empacotamento, publicação e verificação; a recuperação usa uma tag existente e o artefato original. A distribuição é comprovada por instalação temporária e subprocesso da CLI.

**Tech Stack:** release-please manifest/action v4, GitHub App, Node 24 no release, npm OIDC, pnpm, tsup/Vitest, Node test runner.

---

## Mapa de arquivos

- `release-please-config.json`, `.release-please-manifest.json`: política de versão.
- `.github/workflows/release.yml`: substituir fluxo tag/token pelo orquestrador main/App/OIDC.
- `packages/core/CHANGELOG.md`: gerado pelo bot.
- `packages/core/src/index.ts`: marcador de versão atualizado pelo bot.
- `packages/core/tests/version.test.ts`: coerência source/manifest.
- `packages/core/package.json`: engines/repository.directory/package files.
- `scripts/release/policy.mjs`, `policy.test.mjs`: versão e canal puros/testáveis.
- `scripts/release/smoke-package.mjs`: instalar tarball/versão exata e testar CLI/API.
- `scripts/release/verify-release.mjs`: validar tag, SHA, manifest e canal.
- `docs/operations/releases.md`: bootstrap, promoção e recuperação.
- `.github/workflows/ci.yml`, `package.json`, `knip.json`: integrar novos checks/scripts.

## Task 0: Corrigir o falso verde necessário ao caso Agamenon

**Files:** modificar `packages/core/src/core/rules/results-rule.ts`, `src/core/diagnostics.ts`; criar `packages/core/tests/core/result-field-types.test.ts`; atualizar tabela de diagnósticos em `packages/core/README.md` e docs do site.

Evidência já obtida no planejamento: provider retorna objeto com temperature string; consumer exige temperature number; o motor atual devolve pass. A regra só compara tipo raiz e presença de propriedades. Este é um gate real de produto, antes de publicar.

- [ ] Escrever primeiro o teste:

```typescript
import { expect, it } from "vitest";
import { checkResults } from "../../src/core/rules/results-rule.js";

const schema = (type: string) => ({
  type: "object", properties: { temperature: { type } }, required: ["temperature"],
});
it("rejects a string result where the consumer requires a number", () => {
  const diagnostics = checkResults({ format: "json", schema: schema("number") }, {
    name: "getWeather", executionSide: "backend", parameters: { type: "object" },
    returns: { format: "json", schema: schema("string") },
  });
  expect(diagnostics).toContainEqual(expect.objectContaining({
    code: "AIK-RESULT-003", path: "/returns/schema/properties/temperature/type",
    expected: "number", actual: "string",
  }));
});
it("allows integer output for a number consumer", () => {
  expect(checkResults({ format: "json", schema: schema("number") }, {
    name: "getWeather", executionSide: "backend", parameters: { type: "object" },
    returns: { format: "json", schema: schema("integer") },
  })).toEqual([]);
});
```

- [ ] Executar `pnpm --filter @agent-interaction-kit/core test tests/core/result-field-types.test.ts`; primeiro teste deve falhar por diagnóstico ausente.
- [ ] Acrescentar `AIK-RESULT-003` à união de DiagnosticCode. Dentro do loop de campos requeridos do bloco object/object de checkResults, para campos presentes no provider, comparar tipos escalares explícitos usando:

```typescript
const cProps = (cSchema.properties as Record<string, Record<string, unknown>>) || {};
const pField = pProps[reqProp] as Record<string, unknown> | undefined;
const cType = cProps[reqProp]?.type;
const pType = pField?.type;
const scalarTypes = new Set(["string", "number", "integer", "boolean", "null"]);
if (typeof cType === "string" && typeof pType === "string" &&
    scalarTypes.has(cType) && scalarTypes.has(pType) &&
    cType !== pType && !(cType === "number" && pType === "integer")) {
  const segment = reqProp.replace(/~/g, "~0").replace(/\//g, "~1");
  diagnostics.push({
    code: "AIK-RESULT-003", severity: "error", toolName,
    path: `/returns/schema/properties/${segment}/type`,
    message: `Tool "${toolName}": result field "${reqProp}" type is incompatible.`,
    expected: cType, actual: pType,
  });
}
```

Elevar constantes fora do loop se necessário para evitar recriação; preservar safety walker, diagnóstico de campo ausente e direção provider→consumer. Não tratar integer como incompatível com number. Não anunciar suporte universal a JSON Schema; esta correção cobre o tipo escalar de campo requerido em resultado objeto, necessário ao caso real.

- [ ] Adicionar testes de number→integer rejeitado, tipo igual permitido e nome de campo com `/` escapado. Reproduzir o cenário também via evaluateCompatibility para confirmar status fail; o smoke do Agamenon posteriormente prova subprocesso npm.
- [ ] Rodar suíte core, typecheck, check e build; obter revisão antes de merge. Commit sugerido: `fix(core): detect incompatible scalar result fields`. Registrar novo diagnóstico na documentação. Se surgir conflito com uma política existente de subconjunto, resolver explicitamente antes da beta, sem enfraquecer o teste.

## Task 1: Versão e artefato coerentes

- [ ] Criar teste `packages/core/tests/version.test.ts`:

```typescript
import fs from "node:fs";
import { expect, it } from "vitest";
import { AIK_VERSION } from "../src/index.js";

it("exposes the version declared by the npm package", () => {
  const manifest = JSON.parse(fs.readFileSync(new URL("../package.json", import.meta.url), "utf8"));
  expect(AIK_VERSION).toBe(manifest.version);
});
```

Este é um guard de invariantes e deve passar no baseline. Para comprovar sensibilidade, mudar temporariamente só a constante para `0.1.1`, observar falha e restaurar exatamente essa edição.

- [ ] Anotar a constante existente para atualização do release-please:

```typescript
export const AIK_VERSION = "0.1.0"; // x-release-please-version
```

- [ ] No manifest core, acrescentar `repository.directory: "packages/core"`, `engines: {"node": ">=20"}` e restringir `files` a `["dist"]`. Preservar LICENSE/README, incluídos automaticamente pelo npm. Não mudar exports nem renomear pacote/binário.
- [ ] Executar `pnpm --filter @agent-interaction-kit/core test`, `pnpm typecheck`, `pnpm build:core`. Inspecionar `npm pack --dry-run --json` no diretório `packages/core`: todos os destinos de `bin` e `exports` existem, nenhum fixture/teste/env/source TS é incluído.
- [ ] Commit sugerido: `fix(core): align package metadata and executable version`. Não criar tag manual nesse commit.

## Task 2: Testar política beta/estável antes do workflow

- [ ] Criar `scripts/release/policy.test.mjs` antes da implementação:

```javascript
import assert from "node:assert/strict";
import test from "node:test";
import { channelFor, validateTag } from "./policy.mjs";

test("routes beta to next and stable to latest", () => {
  assert.equal(channelFor("1.0.0-beta.1"), "next");
  assert.equal(channelFor("1.2.3"), "latest");
});
test("rejects invalid, unsupported or mismatched release tags", () => {
  for (const value of ["main", "1.0", "1.0.0-rc.1", "1.0.0-beta.01", "01.0.0", "1.0.0+meta"]) {
    assert.throws(() => channelFor(value));
  }
  assert.throws(() => validateTag("v2.0.0", "1.0.0"));
  assert.throws(() => validateTag("main", "1.0.0"));
  assert.equal(validateTag("v1.0.0-beta.1", "1.0.0-beta.1"), "next");
});
```

- [ ] Executar `node --test scripts/release/policy.test.mjs`; esperar falha por módulo ausente. Implementar `policy.mjs`:

```javascript
const versionPattern = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-beta\.([1-9]\d*))?$/;

export function channelFor(version) {
  if (!versionPattern.test(version)) throw new Error(`Unsupported release version: ${version}`);
  return version.includes("-beta.") ? "next" : "latest";
}

export function validateTag(tag, version) {
  const channel = channelFor(version);
  if (tag !== `v${version}`) throw new Error("Release tag does not match package version");
  return channel;
}
```

- [ ] Rodar novamente e obter todos os testes verdes. Rejeitar rc/build metadata é política deliberada desta entrega, não validação universal de SemVer. Acrescentar outros canais somente quando forem adotados.

## Task 3: Instalação limpa e subprocesso da CLI

- [ ] Criar `scripts/release/smoke-package.mjs` com o contrato abaixo. Ele recebe um tarball absoluto ou spec npm exato e a versão esperada; não importa `runCheck` do workspace:

```javascript
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const [source, expectedVersion] = process.argv.slice(2);
assert.ok(source && expectedVersion, "Usage: smoke-package.mjs <tarball|exact npm spec> <version>");
const root = fileURLToPath(new URL("../../", import.meta.url));
const fixtures = path.join(root, "packages/core/fixtures");
const cwd = mkdtempSync(path.join(os.tmpdir(), "aik-consumer-"));
const run = (cmd, args) => spawnSync(cmd, args, {
  cwd, encoding: "utf8", timeout: 120000,
  env: { ...process.env, NODE_PATH: "" },
});
try {
  writeFileSync(path.join(cwd, "package.json"), JSON.stringify({
    name: "aik-release-smoke", private: true, type: "module",
    scripts: { "test:contracts": "aik check" },
  }));
  const install = run("npm", ["install", "--ignore-scripts", "--no-audit", "--no-fund", "--save-dev", "--save-exact", source]);
  assert.equal(install.status, 0, install.stderr);
  const installed = JSON.parse(readFileSync(path.join(cwd, "node_modules/@agent-interaction-kit/core/package.json"), "utf8"));
  assert.equal(installed.version, expectedVersion);
  const version = run("npm", ["exec", "--", "aik", "--version"]);
  assert.equal(version.status, 0, version.stderr);
  assert.equal(version.stdout.trim(), expectedVersion);
  const imports = run(process.execPath, ["--input-type=module", "-e", `
    for (const suffix of ["", "/contracts", "/core", "/reporters"]) {
      await import("@agent-interaction-kit/core" + suffix);
    }
  `]);
  assert.equal(imports.status, 0, imports.stderr);
  const cases = [
    ["valid", true, 0, "pass"],
    ["breaking-result", true, 1, "fail"],
    ["breaking-args", true, 1, "fail"],
    ["missing-tool", true, 1, "fail"],
    ["unknown-schema", false, 0, "unknown"],
    ["unknown-schema", true, 2, "unknown"],
    ["frontend-tool", true, 0, "pass"],
  ];
  for (const [name, strict, code, status] of cases) {
    const result = run("npm", ["run", "--silent", "test:contracts", "--",
      "--provider", path.join(fixtures, name, "provider.json"),
      "--consumer", path.join(fixtures, name, "consumer.json"),
      "--format", "json", ...(strict ? ["--strict"] : []),
    ]);
    assert.equal(result.status, code, `${name}: ${result.stderr}`);
    assert.equal(JSON.parse(result.stdout).status, status);
  }
  writeFileSync(path.join(cwd, "invalid.json"), "{}");
  const invalid = run("npm", ["run", "--silent", "test:contracts", "--",
    "--provider", "invalid.json", "--consumer", "invalid.json", "--strict"]);
  assert.equal(invalid.status, 2, invalid.stderr);
  console.log(JSON.stringify({ source, version: installed.version, cli: "passed", imports: "passed", scenarios: 8 }));
} finally {
  rmSync(cwd, { recursive: true, force: true });
}
```

- [ ] Comprovar falha com versão esperada incorreta em um tarball do baseline; depois executar com a versão correta. Gerar o pacote em diretório previamente verificado, via `npm pack --json --pack-destination DIR` no core. Usar o filename retornado pelo npm, não glob que pode selecionar tarball antigo.
- [ ] Acrescentar inspeção de `npm pack --dry-run --json` antes de empacotar: falhar se `files[].path` não for `package.json`, `README.md`, `LICENSE` ou iniciar com `dist/`; exigir todos os paths de `bin` e exports. Adicionar testes reais do allowlist com entrada permitida, fixture e `.env` recusados, destino de export ausente; não só snapshot.
- [ ] Criar job `package-smoke` na CI: instalar frozen, testar policy, build core, pack uma vez, executar smoke no tarball. Acrescentar resultado ao gate `CI required`. Testar ao menos Node 20 e 24 antes de declarar engines; a matriz existente testa código-fonte, não instalação do tarball.
- [ ] Incluir scripts em `package.json` (`test:release`: `node --test scripts/release/*.test.mjs`) e entry/project de scripts no workspace raiz do Knip. Manter `pnpm knip`/Biome verdes sem ignorar todo o diretório novo.
- [ ] Commit sugerido: `test(core): verify packaged CLI and public exports`.

## Task 4: Configurar release-please e comprovar o bump

- [ ] Criar `release-please-config.json`:

```json
{
  "$schema": "https://raw.githubusercontent.com/googleapis/release-please/main/schemas/config.json",
  "bootstrap-sha": "7fc1d36c6043acb76fbcf0b8818dd3562e2cfe95",
  "packages": {
    "packages/core": {
      "release-type": "node",
      "package-name": "@agent-interaction-kit/core",
      "include-component-in-tag": false,
      "include-v-in-tag": true,
      "versioning": "prerelease",
      "prerelease": true,
      "prerelease-type": "beta",
      "extra-files": [{"type": "generic", "path": "src/index.ts"}]
    }
  }
}
```

Manifest inicial `.release-please-manifest.json`:

```json
{"packages/core": "0.1.0"}
```

`0.1.0` é baseline de código, não tag/publicação inventada. O primeiro commit convencional relevante do core deve carregar o footer `Release-As: 1.0.0-beta.1`; pode ser a descrição preservada no squash do PR de preparação. Não manter `release-as` fixo no config, pois ele impediria avanços posteriores.

- [ ] Validar config pelo schema oficial da versão adotada e usar dry-run de `release-please release-pr --help`/manifest correspondente para conferir caminho do extra-file e versão proposta. Confirmar no diff real do bot `packages/core/src/index.ts`, manifest, package.json e changelog. Se um flag da CLI mudou, seguir o help da versão fixada, não publicar para descobrir.
- [ ] Criar testes de versionamento com a biblioteca release-please fixada: `1.0.0-beta.1 + fix`, `+feat`, `+breaking` → `1.0.0-beta.2`; após configuração estável, `1.0.0 +fix` → `1.0.1`, `+feat` → `1.1.0`, `+breaking` → `2.0.0`. Testar primeiro Release-As e ausência de release para website-only em dry-run contra histórico. A versão da ferramenta é fixa e a API deve ser consultada antes de escrever o teste; a lógica esperada está definida aqui.
- [ ] Preparar a etapa App/action no workflow `release.yml`:

```yaml
name: Release
on:
  push:
    branches: [main]
  workflow_dispatch:
    inputs:
      tag:
        description: Existing release tag to resume
        required: true
        type: string
permissions:
  contents: read
concurrency:
  group: aik-release
  cancel-in-progress: false
jobs:
  release:
    if: github.event_name == 'push'
    runs-on: ubuntu-latest
    outputs:
      created: ${{ steps.rp.outputs['packages/core--release_created'] }}
      tag: ${{ steps.rp.outputs['packages/core--tag_name'] }}
      sha: ${{ steps.rp.outputs['packages/core--sha'] }}
    steps:
      - uses: actions/create-github-app-token@v2
        id: app
        with:
          app-id: ${{ vars.RELEASE_APP_ID }}
          private-key: ${{ secrets.RELEASE_APP_PRIVATE_KEY }}
          owner: ${{ github.repository_owner }}
          repositories: agent-interaction-kit
      - uses: googleapis/release-please-action@v4
        id: rp
        with:
          token: ${{ steps.app.outputs.token }}
          config-file: release-please-config.json
          manifest-file: .release-please-manifest.json
          target-branch: main
```

Fixar Actions em SHA durante implementação. Não executar install/build no job com a chave App disponível. O campo `created` é string: comparar explicitamente a `'true'`.
- [ ] Antes de executar release-please no push, verificar que a execução da CI para o SHA candidato concluiu com sucesso. Em runs atrasados, se main já avançou, deixar a execução mais nova reconciliar o bot. No publish, repetir a verificação para o SHA exato da tag; release-please pode encontrar uma release PR mesclada antes do push atual.
- [ ] Integrar a PR real do bot aos checks requeridos, sem isentar bot do título ou da main atualizada. Testar atualização de branch do bot pela App. Não conceder bypass para contornar um check mal configurado.

## Task 5: Verificação de tag e recuperação

- [ ] Implementar `scripts/release/verify-release.mjs`:

```javascript
import { execFileSync } from "node:child_process";
import { readFileSync, appendFileSync } from "node:fs";
import assert from "node:assert/strict";
import { validateTag } from "./policy.mjs";

const tag = process.argv[2];
const manifest = JSON.parse(readFileSync("packages/core/package.json", "utf8"));
const channel = validateTag(tag, manifest.version);
assert.equal(manifest.name, "@agent-interaction-kit/core");
assert.equal(manifest.private, undefined);
const git = (...args) => execFileSync("git", args, { encoding: "utf8" }).trim();
const sha = git("rev-parse", `refs/tags/${tag}^{commit}`);
assert.equal(git("rev-parse", "HEAD"), sha);
git("merge-base", "--is-ancestor", sha, "origin/main");
const result = { tag, sha, version: manifest.version, channel };
if (process.env.GITHUB_OUTPUT) {
  for (const [key, value] of Object.entries(result)) appendFileSync(process.env.GITHUB_OUTPUT, `${key}=${value}\n`);
}
console.log(JSON.stringify(result));
```

- [ ] Exercitar em repositório temporário de teste: tag correta, tag divergente, HEAD divergente e tag fora da main. Todos os negativos devem falhar antes de comandos npm de publicação.
- [ ] Acrescentar job de publicação ao mesmo `release.yml`; inputs efetivos e condições:

```yaml
  publish:
    needs: release
    if: >-
      always() &&
      ((github.event_name == 'push' && needs.release.outputs.created == 'true') ||
       (github.event_name == 'workflow_dispatch' && github.ref == 'refs/heads/main'))
    runs-on: ubuntu-latest
    environment: npm
    permissions:
      contents: write
      actions: read
      id-token: write
    env:
      RELEASE_TAG: ${{ inputs.tag || needs.release.outputs.tag }}
```

`contents: write` aqui serve para anexar artefatos à GitHub Release. Não fornecer token como credencial persistida no checkout. O job deve seguir esta sequência, com cada etapa identificável:

1. Checkout da main para validar sintaxe do input; fetch completo das tags/main.
2. Confirmar `gh release view "$RELEASE_TAG"` existente e checkout do commit exato da tag; rodar `verify-release.mjs`. Não usar `inputs.tag` como shell interpolado nem como branch alternativa.
3. Consultar CI (`CI Matrix`, evento push) bem-sucedida no SHA exato; aguardar ou falhar, nunca aceitar CI de outro SHA. Consultar API com timeout limitado.
4. Setup Node 24 e npm exato compatível com OIDC; pnpm fixado e install frozen. Executar check, Knip, typecheck core, testes e build core.
5. Inspecionar e empacotar uma vez. Guardar filename, SRI SHA512, versão e SHA em metadata. Rodar smoke no tarball.
6. Anexar tarball original à GitHub Release e reusar esse artefato em recuperação. Se já existir, comparar metadata; não sobrescrevê-lo com um rebuild diferente.
7. Se `NPM_PUBLISH_ENABLED != 'true'`, terminar como **bootstrap aguardando publicação**, sem acionar site; registrar artefato. Caso contrário, consultar a versão exata no registry.
8. Versão ausente: `npm publish "$TARBALL" --access public --tag "$NPM_CHANNEL"` com OIDC. O tarball é o mesmo testado, no workspace da tag. Não usar `pnpm publish` dependente de npm antigo, `NPM_TOKEN` ou `--no-git-checks` como substituto de verificação.
9. Versão existente: comparar `dist.integrity` com o artefato original e metadata; só seguir quando forem iguais. Não tratar timeout/403/erro npm como 404. Não reaplicar dist-tag antiga em retry.
10. Aguardar disponibilidade por tentativas limitadas (por exemplo 12 × 10 s), instalar versão exata via smoke e conferir integridade/canal/provenance. Em retry antigo, registrar que não é mais o head do canal e não fazer deploy automático antigo.
11. Anexar `publication.json` somente depois de todos os checks, com `{version, channel, tag, sha, integrity, verifiedAt, workflowRunUrl}`. Esse artefato é o registro usado pelo promotor do website. Não escrever tokens.

- [ ] Adicionar testes de integração do fluxo de decisão com registry simulado: absent→publish, existing+equal→verify, existing+different→fail, auth error→fail, retry antigo→não retag/deploy. Não realizar publishes descartáveis para testar esses ramos.

## Task 6: Bootstrap real e OIDC

- [ ] Mesclar a preparação e o primeiro release PR somente após validar bump `1.0.0-beta.1` e checks. O workflow deve produzir a tag, prerelease e tarball de bootstrap sem tentar autenticação inexistente.
- [ ] Mantenedor baixa o tarball da GitHub Release, compara o checksum registrado, autentica com `npm login`/2FA e publica esse arquivo com `--access public --tag next`. Não construir um pacote vazio para reservar nome. Confirmar que `latest` não aponta para beta; caso o registry crie esse alias no primeiro publish, corrigir explicitamente com autenticação do mantenedor e documentar.
- [ ] Cadastrar trusted publisher no pacote: owner `DevJoaoLopes`, repo `agent-interaction-kit`, workflow `release.yml`, environment `npm`, permissão direta `npm publish` habilitada. Usar Node/npm mínimos documentados; não usar `npm whoami` para provar OIDC (ele não comprova essa autenticação).
- [ ] Definir `NPM_PUBLISH_ENABLED=true`. Reexecutar `release.yml` na main com tag `v1.0.0-beta.1`: deve detectar publicação igual, instalar e verificar, sem sobrescrever npm. Registrar se a primeira versão não tem provenance, em vez de fingir que o bootstrap local a gerou.
- [ ] Fazer uma melhoria real descoberta na validação, publicar `beta.2` via release PR e comprovar OIDC/provenance. Não criar commit vazio/publicação sem mudança apenas para o teste. Só declarar fluxo automático funcionando após esse publish real.

## Task 7: Promoção e recuperação documentadas

- [ ] Em `docs/operations/releases.md`, registrar os três estados: tag criada, npm publicado, publicação verificada. A GitHub Release sozinha não satisfaz o gate do website.
- [ ] Para promover a primeira estável, após Agamenon: alterar política para `prerelease: false`, `versioning: default`, retirar `prerelease-type` e inserir footer único `Release-As: 1.0.0` num commit relevante ao core. O bot prepara PR da estável; o mantenedor aprova. Nunca promover automaticamente ao fim do teste.
- [ ] Documentar `gh workflow run release.yml --ref main -f tag=v1.0.0-beta.1` para recuperação da beta, com pré-condições: tag existente, artefato original, integridade igual. Deploy é etapa separada; não repetir publish para reparar site.
- [ ] Versão defeituosa: corrigir e lançar outra versão; documentar depreciação quando necessária. Não mover tag já publicada, forçar git push ou assumir que npm permite sobrescrever.
- [ ] Gate: PR do bot com checks, tarball real instalado, bootstrap documentado, publicação seguinte OIDC comprovada, retry testado, `publication.json` disponível para o plano Vercel.
