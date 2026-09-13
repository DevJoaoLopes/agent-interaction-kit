# OSS Governance and Accounts Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tornar o repositório operável por um mantenedor solo com PRs verificáveis, contas preparadas e main protegida.

**Architecture:** Checks sem secrets precedem rulesets remotos. GitHub App é limitada ao bot de releases; publicação npm e deploy têm environments separados. Documentação OSS define expectativas reais, não obrigações empresariais.

**Tech Stack:** GitHub Actions, GitHub App, REST API via gh, commitlint, pnpm, Markdown.

---

## Arquivos e responsabilidades

- Modificar `.github/workflows/ci.yml`: gate estável, permissions e cancelamento de CI obsoleta.
- Modificar `.github/workflows/commitlint.yml`: validar título que será o squash commit.
- Criar `CONTRIBUTING.md`, `SECURITY.md`, `CODE_OF_CONDUCT.md` e `.github/PULL_REQUEST_TEMPLATE.md`.
- Criar `.github/ISSUE_TEMPLATE/bug_report.yml`, `feature_request.yml`, `config.yml`.
- Criar `.github/rulesets/main.json`, `release-tags.json`: estado remoto desejado.
- Criar `docs/operations/accounts.md`, `docs/operations/governance.md`: procedimentos e evidências sem segredos.

## Task 1: Preflight e inventário

- [ ] Registrar `git status --short --branch`, `git rev-parse HEAD`, `git remote -v`, `git log --oneline -10` no AIK. Ler instruções locais antes de editar.
- [ ] Consultar estado remoto com:

```bash
gh repo view DevJoaoLopes/agent-interaction-kit --json nameWithOwner,isPrivate,defaultBranchRef
gh api repos/DevJoaoLopes/agent-interaction-kit/rulesets
gh api repos/DevJoaoLopes/agent-interaction-kit/actions/permissions/workflow
gh api repos/DevJoaoLopes/agent-interaction-kit/environments
gh secret list --repo DevJoaoLopes/agent-interaction-kit
gh variable list --repo DevJoaoLopes/agent-interaction-kit
```

Esperado: identificar configuração real, não assumir que o baseline sem proteção/secrets continua válido. Se já houver ruleset, planejar PATCH pelo ID em vez de criar duplicata.

- [ ] Registrar Node/pnpm e rodar baseline:

```bash
node --version
pnpm --version
pnpm install --frozen-lockfile
pnpm check
pnpm knip
pnpm typecheck
pnpm test
pnpm build
pnpm --filter @agent-interaction-kit/website exec playwright install chromium
pnpm test:web
```

Esperado: comandos passam ou falhas preexistentes são identificadas antes de atribuí-las ao trabalho novo. Não executar a suíte live do Agamenon nessa etapa.

## Task 2: Contas e identidade do bot

- [ ] Com a sessão npm do mantenedor, executar `npm whoami --registry=https://registry.npmjs.org` e `npm org ls agent-interaction-kit --json`. Se não houver login/permissão, o mantenedor autentica/cria a organização pública gratuita ou concede acesso ao escopo. Não renomear o pacote silenciosamente se o escopo não puder ser obtido.
- [ ] Criar GitHub App em Settings → Developer settings → GitHub Apps, sem webhook para este uso. Nome preferido `AIK Release Bot` (nome de App sujeito a disponibilidade). Instalar somente em `DevJoaoLopes/agent-interaction-kit`.
- [ ] Conceder permissions da App: `Contents: Read and write`, `Pull requests: Read and write`, `Issues: Read and write`; metadata read implícita. Não conceder administration, secrets, workflows write ou aprovação/bypass de main.
- [ ] Guardar App ID como variável `RELEASE_APP_ID`; guardar a chave PEM como secret `RELEASE_APP_PRIVATE_KEY` diretamente no GitHub. Não enviar a chave no chat, não versioná-la e não incluí-la em artefatos.
- [ ] Registrar em `docs/operations/accounts.md` apenas nomes dos recursos, responsáveis e links de settings. Incluir:

```text
RELEASE_APP_ID: repository Actions variable
RELEASE_APP_PRIVATE_KEY: repository Actions secret
NPM_PUBLISH_ENABLED: repository Actions variable, initially false
VERCEL_ORG_ID: repository Actions variable
VERCEL_PROJECT_ID: repository Actions variable
VERCEL_TOKEN: secret in environment vercel-production
SITE_URL: repository Actions variable after hostname assignment
NPM_TOKEN: not required for recurring publication
```

- [ ] Criar environments `npm` e `vercel-production`, sem segundo aprovador obrigatório. Restringir os workflows de produção à main; jobs manuais devem ser disparados na main e validar tags por código. O environment `npm` fará parte da identidade do trusted publisher.
- [ ] No cadastro Vercel, tentar criar projeto `agent-interaction-kit` e atribuir o hostname exato. Confirmar via dashboard/API autenticada, não por DNS/404. Se recusado, solicitar ao mantenedor outro nome antes de prosseguir. Documentar resultado; não comprar domínio.

## Task 3: Checks exigíveis sem travar o mantenedor

- [ ] Alterar o workflow Commitlint para usar apenas título PR e declarar nome estável. Preservar os triggers existentes de título editado:

```yaml
jobs:
  commitlint:
    name: PR title
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          persist-credentials: false
      - uses: pnpm/action-setup@v4
        with:
          version: 10
      - uses: actions/setup-node@v4
        with:
          node-version: 24
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - name: Validate squash commit subject
        env:
          PR_TITLE: ${{ github.event.pull_request.title }}
        run: printf '%s\n' "$PR_TITLE" | pnpm exec commitlint
```

Remover o passo `wagoid/commitlint-github-action` que valida todos os commits intermediários. Manter `contents: read` e `pull-requests: read`; não usar `pull_request_target` para checkout de código do PR.

- [ ] Acrescentar ao topo da CI existente:

```yaml
permissions:
  contents: read
concurrency:
  group: ci-${{ github.event.pull_request.number || github.ref }}
  cancel-in-progress: true
```

- [ ] Acrescentar o job final abaixo, mantendo a matriz e o website existentes. Quando o plano npm adicionar o job `package-smoke`, incluí-lo em `needs` e no teste:

```yaml
  required:
    name: CI required
    if: ${{ always() }}
    needs: [lint, core-matrix, website]
    runs-on: ubuntu-latest
    steps:
      - name: Require every test group
        env:
          LINT: ${{ needs.lint.result }}
          CORE: ${{ needs.core-matrix.result }}
          WEBSITE: ${{ needs.website.result }}
        run: |
          test "$LINT" = success
          test "$CORE" = success
          test "$WEBSITE" = success
```

Não filtrar o workflow requerido inteiro por paths. Um job pulado ou cancelado não satisfaz o gate.

- [ ] Resolver as versões de Actions usadas neste PR para SHAs reais usando `gh api repos/OWNER/REPO/commits/REF --jq .sha`, revisar o upstream e substituir `uses` por `@SHA` com comentário da versão. Repetir para os novos workflows dos outros planos; Dependabot mantém esses pins. Não usar SHA inventado nem atualizar majors de todas as Actions sem testar.
- [ ] Abrir PR e verificar com `gh pr checks --watch`: `PR title` e `CI required` devem aparecer. Alterar temporariamente o título para inválido e confirmar falha; restaurar para título válido. Não criar testes de snapshot de YAML só para reproduzir a implementação.

## Task 4: Documentos OSS mínimos e úteis

- [ ] Criar `CONTRIBUTING.md` em inglês, como as docs públicas existentes, com os comandos do Task 1, mapa `packages/core`/`apps/website`, scopes `core`, `website`, `deps`, a regra de squash e exemplos:

```text
fix(core): reject incompatible result types
feat(core): add a report format
feat(core)!: change manifest schema
docs(website): clarify setup instructions
```

Explicar que website-only não publica npm; alterações em deps/lockfile que alteram o pacote precisam ser consideradas na release. A branch do bot não deve receber alterações de produto manuais. O mantenedor revisa bump/changelog e mescla quando desejar.

- [ ] Criar `SECURITY.md` com conteúdo operacional: reportar via `https://github.com/DevJoaoLopes/agent-interaction-kit/security/advisories/new`, não abrir vulnerabilidade com detalhes em issue pública; beta é experimental; após 1.0, priorizar a última estável; suporte best effort, sem SLA. Habilitar e verificar private vulnerability reporting antes de publicar esse link como canal funcional.
- [ ] Criar `CODE_OF_CONDUCT.md`: comunicação respeitosa, proibição de assédio/divulgação de dados, aplicação proporcional pelo mantenedor. Usar contato privado fornecido pelo mantenedor em uma etapa de configuração; se não existir contato privado disponível, manter este documento fora do PR até obter um canal real, registrando o bloqueio. Não reutilizar o canal de vulnerabilidade como canal genérico de moderação sem consentimento.
- [ ] Criar template PR com estes itens:

```markdown
## Summary

## Verification
- [ ] Relevant checks passed.
- [ ] User-facing behavior has examples and documentation.
- [ ] Breaking changes and release impact are stated.
- [ ] Commands were checked from a clean consumer installation when onboarding changed.
- [ ] No secrets or private application data are included.
```

- [ ] Criar forms de bug/feature com campos obrigatórios: versão AIK, Node/SO, comando mínimo, manifests reduzidos sem dados sensíveis, esperado/obtido; para feature, problema e exemplo de uso. `config.yml` deve direcionar vulnerabilidades ao canal privado verificado. Testar renderização no GitHub e não exigir um processo de contribuição longo para mudanças pequenas.
- [ ] Manter MIT e atribuições das fontes/marcas existentes. Não adicionar CLA, DCO, funding ou CODEOWNERS com aprovação obrigatória sem necessidade aprovada.
- [ ] Validar links relativos e revisar docs como novo contribuidor. Commit sugerido: `docs: document contribution and support workflows`.

## Task 5: Aplicar proteção depois de observar os checks

- [ ] Criar `.github/rulesets/main.json`:

```json
{
  "name": "main-protection",
  "target": "branch",
  "enforcement": "active",
  "bypass_actors": [],
  "conditions": {"ref_name": {"include": ["refs/heads/main"], "exclude": []}},
  "rules": [
    {"type": "deletion"},
    {"type": "non_fast_forward"},
    {"type": "required_linear_history"},
    {"type": "pull_request", "parameters": {
      "required_approving_review_count": 0,
      "dismiss_stale_reviews_on_push": false,
      "require_code_owner_review": false,
      "require_last_push_approval": false,
      "required_review_thread_resolution": true
    }},
    {"type": "required_status_checks", "parameters": {
      "strict_required_status_checks_policy": true,
      "do_not_enforce_on_create": false,
      "required_status_checks": [{"context": "CI required"}, {"context": "PR title"}]
    }}
  ]
}
```

- [ ] Obter o `app.id` dos check runs reais no SHA de uma PR e adicionar `integration_id` correspondente a GitHub Actions em cada required_status_check. Isso vincula os checks à origem observada em vez de confiar só no nome.
- [ ] Configurar merge methods:

```bash
gh api --method PATCH repos/DevJoaoLopes/agent-interaction-kit \
  -F allow_merge_commit=false -F allow_rebase_merge=false -F allow_squash_merge=true \
  -f squash_merge_commit_title=PR_TITLE -f squash_merge_commit_message=PR_BODY \
  -F allow_auto_merge=false -F delete_branch_on_merge=true
```

- [ ] Aplicar ruleset via `gh api --method POST repos/DevJoaoLopes/agent-interaction-kit/rulesets --input .github/rulesets/main.json`, ou PUT no ID existente após revisar diferenças. Ler a configuração de volta.
- [ ] Criar `release-tags.json` com target `tag`, condição `refs/tags/v*` e regras `update`, `deletion`, sem regra de `creation`. Assim o bot pode criar tags, mas elas não são movidas/apagadas normalmente. Aplicar e verificar sem realizar force push ou exclusão experimental.
- [ ] Habilitar Dependabot security updates e private vulnerability reporting pelas APIs/settings e ler de volta. Continuar sem auto-merge. Não exigir um job de preview externo como bloqueador se ele depende de aprovação de fork.
- [ ] Verificar PR real com check pendente: merge não habilitado; check verde permite ao mantenedor mesclar sem outra pessoa. Não testar proteção tentando sobrescrever a main.
- [ ] Salvar em `docs/operations/governance.md`: IDs dos rulesets, nomes dos checks, permissões, links da PR de prova e procedimento administrativo de recuperação em caso de check renomeado. Nunca orientar desativar proteção como rotina.

## Gate de saída

- [ ] Main protegida e bot sem bypass; PR solo continua viável.
- [ ] Conta npm/scope e hostname Vercel confirmados, ou bloqueios explícitos registrados.
- [ ] Credenciais existem somente nos settings apropriados.
- [ ] Docs OSS publicadas apenas com canais de contato funcionais.
- [ ] Prosseguir para o plano npm; não confundir contas configuradas com distribuição testada.
