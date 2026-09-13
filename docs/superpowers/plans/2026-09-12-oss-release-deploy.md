# AIK Open Source Release and Deployment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Entregar publicação npm revisável, main protegida, website Vercel rastreável e validação real no Agamenon.

**Architecture:** Um pacote público, release-please manifest com GitHub App, publicação npm por OIDC após bootstrap e promotor único de website. A CI de contribuições permanece independente dos secrets de publicação. Os quatro planos abaixo são unidades executáveis com gates explícitos.

**Tech Stack:** pnpm 10, TypeScript, tsup, Vitest, GitHub Actions/App/rulesets, release-please, npm OIDC, Astro/React, Vercel, Playwright, Zod 3 no Agamenon.

---

## Documentos e ordem

Desenho aprovado: [spec](../specs/2026-09-12-oss-release-deploy-design.md).

1. [Governança e contas](2026-09-12-oss-governance.md): preflight, contas, docs OSS, checks e main protegida.
2. [Release e distribuição npm](2026-09-12-npm-release.md): tarball testável, release-please, bootstrap beta e OIDC.
3. [Website e documentação](2026-09-12-vercel-docs.md): exemplos publicados, preview, pipeline de produção e recuperação.
4. [Adoção no Agamenon](2026-09-12-agamenon-validation.md): integração real e promoção estável.

Cada tarefa deve passar pelas verificações indicadas antes de avançar. Não executar comandos de publish/deploy durante a fase de escrita/revisão do plano.

## Dependências

```text
Preflight AIK + contas + nome Vercel
 ├─ docs OSS / PR title / CI gates → proteção main
 ├─ smoke tarball / versão → release PR → bootstrap beta npm
 │                                         └─ trusted publisher → segunda beta OIDC
 └─ docs onboarding + previews Vercel ───────┬─ produção beta validada
                                           └─ Agamenon contratos + runtime
                                                  └─ PR promoção estável
```

Previews e documentação podem ser preparados antes da primeira publicação; produção não deve anunciar um pacote que ainda não foi validado no registry. Preparar a extração de schemas do Agamenon é possível antes, mas o teste de adoção exige a versão real do npm.

## Entregas sugeridas por PR

| PR | Conteúdo | Gate |
| --- | --- | --- |
| A | Documentos OSS, título PR, agregador CI | checks observados antes de aplicar ruleset |
| B | Correção de tipos de resultado, smoke tarball, versão, metadata do core | drift real detectado, instalação limpa, imports e CLI |
| C | App + release-please + workflow de publicação | candidato beta e tag/versão coerentes |
| D | Quickstart e exemplos executáveis | pacote de teste funciona, editorial revisado |
| E | Vercel preview/produção | hostname atribuído e deploy beta verificado |
| F, no Agamenon | schemas puros, manifests e contrato em CI | CLI npm detecta drift e baseline passa |
| G, bot | beta seguinte e depois promoção | OIDC real e aceitação do mantenedor |

Os commits sugeridos nos subplanos são checkpoints para a execução, não autorização para commitar estes documentos nesta fase. Publicar mudanças no Agamenon é uma entrega separada: não assumir autorização para push/merge desse repositório.

## Participação do mantenedor

| Ação | Por que depende da conta |
| --- | --- |
| Login npm, 2FA, criação/acesso ao scope | GitHub e npm têm identidades independentes |
| Criar/instalar GitHub App e armazenar chave | chave privada não deve passar pelo chat |
| Atribuir nome Vercel e gerar credencial de deploy | 404 público não reserva hostname |
| Publicar primeira beta autenticada | trusted publisher requer pacote existente |
| Cadastrar trusted publisher | ligar owner/repo/workflow/environment exatos |
| Mesclar release PRs | decisão editorial/versionamento explicitamente humana |
| Aprovar promoção estável | beta testada não autoriza automaticamente 1.0.0 |

As outras tarefas devem progredir enquanto houver um desses gates pendente. Registrar bloqueio concreto e próxima ação, sem substituir publicação real por resultado simulado.

## Critérios finais, sem alegação genérica de “100%”

- [ ] Configurações remotas lidas de volta e documentadas.
- [ ] PR do bot e PR de contribuidor passam pelo mesmo gate de CI.
- [ ] Primeira beta instalada do npm; próxima beta publicada por OIDC.
- [ ] Tarball, CLI, API, SemVer, canal e provenance verificados.
- [ ] Website público, preview por PR e atualização website-only comprovados.
- [ ] Docs executadas e revisadas do ponto de vista de um usuário novo.
- [ ] Falhas de deploy/reexecução demonstradas sem republicar npm.
- [ ] Agamenon validado com pacote npm e runtime real, estado restaurado.
- [ ] Relatório distingue testes executados, resultados, limites e pendências.
- [ ] PR de promoção estável apresentado ao mantenedor, sem merge automático.

## Convenções de execução

- Trabalhar no AIK em branch de implementação; verificar a preferência de isolamento antes de criar worktree. No Agamenon, usar obrigatoriamente o checkout atual indicado.
- Revalidar AGENTS.md, git status, comandos e versões quando a execução começar.
- Usar `apply_patch` para mudanças; evitar sobrescrever arquivos inteiros com alterações de terceiros.
- TDD para scripts de política e regressões do pacote; não criar testes que apenas espelham YAML ou textos de documentação.
- Configurações de serviço precisam de verificação funcional além de parse/schema local.
- Escolher versões exatas de novas ferramentas pelo registry e registrar no lockfile; resolver refs de Actions para SHAs reais na execução. Não inventar SHAs nos documentos.
- Ao criar PR, seguir os checks e revisão do repositório. Com main protegida, nenhum push direto para concluir mais rápido.
