# AIK: publicação, governança e validação de adoção

## Aprovação e baseline

Desenho aprovado pelo mantenedor nesta conversa. Data do documento: 2026-09-12.
Baseline inspecionado: `7fc1d36c6043acb76fbcf0b8818dd3562e2cfe95`, branch `main`, árvore limpa.
Os PRs #7–#12 estão mesclados. Revalidar fatos externos na execução; este documento não comprova publicação ou deploy.

Lacuna confirmada durante a escrita: `checkResults` compara o tipo raiz e a presença de campos, mas não o tipo escalar de `temperature`. O bundle local retornou pass para provider string/consumer number, consistente com a inspeção de `packages/core/src/core/rules/results-rule.ts`. Corrigir essa regressão de compatibilidade antes da beta é pré-condição do cenário aprovado; não substituir o cenário por outro mais fácil para obter verde.

## Objetivo

Permitir que um mantenedor independente publique `@agent-interaction-kit/core` com versão e changelog revisáveis, proteja a `main`, mantenha documentação utilizável e demonstre a adoção da versão pública no Agamenon.

## Decisões fechadas

| Tema | Decisão |
| --- | --- |
| Automação | release-please cria/atualiza PR de release; o mantenedor decide quando mesclar |
| Histórico | squash merge, título Conventional Commit como assunto do commit |
| Primeiro lançamento | `1.0.0-beta.1`, canal npm `next`, GitHub prerelease |
| Betas seguintes | `1.0.0-beta.2` etc. enquanto se valida a primeira versão |
| Promoção | PR explícito aprovado pelo mantenedor para `1.0.0`/`latest` |
| Escopo publicável | somente `packages/core`; raiz e website privados no npm |
| Bot | GitHub App instalada apenas no repositório, sem bypass da main |
| npm | bootstrap autenticado; publicações recorrentes via OIDC |
| Main | PR, checks e resolução de threads obrigatórios; sem aprovação externa obrigatória |
| Dependabot | atualização automática dos PRs, merge manual |
| Hosting | Vercel; domínio próprio pago somente após validar todo o fluxo |
| Endereço desejado | `agent-interaction-kit.vercel.app`; atribuição ainda não confirmada |
| Website | previews por PR; mudanças exclusivas do site podem ir à produção sem release npm |
| Documentação | versão publicada como referência; beta pública e claramente identificada |
| Adoção | devDependency + script de CI como recomendação; execução avulsa também documentada |
| Agamenon | checkout atual `/Users/joaopiga/Desenvolvimento/agamenon`, usando os ambientes já configurados |

## 1. Natureza do produto

AIK é um pacote npm com CLI (`aik`) e API programática (`/core`, `/contracts`, `/reporters`).
Instalação em `devDependencies` não elimina sua natureza de CLI. A execução avulsa baixa o pacote para cache sem alterar o manifest do consumidor.

O pacote compara manifests fornecidos pelo consumidor; não descobre ferramentas nem extrai contratos de qualquer framework automaticamente. Para Agamenon, criar uma integração explícita dos schemas reais. Não acrescentar um gerador universal ao AIK nesta entrega.

## 2. Release e invariantes

`fix` gera patch, `feat` gera minor e breaking change gera major após 1.0. Durante a validação de 1.0, mudanças relevantes incrementam o identificador beta. Documentar as duas fases e testar a configuração real do release-please.

Um único componente no manifest do release-please: `packages/core`. Website-only não deve abrir release PR. Alterações de lockfile/dependências que afetem o artefato precisam de um commit convencional que toque o componente; não assumir que mudança na raiz é automaticamente atribuída ao core.

O fluxo tem estados observáveis:

1. CI aprovada para o código candidato.
2. Release PR revisado e mesclado.
3. release-please cria tag e GitHub Release/prerelease.
4. Checkout do SHA exato da tag, validação e empacotamento.
5. Publicação do tarball validado no npm ou identificação verificável de publicação já concluída.
6. Instalação da versão exata do registry e smoke test.
7. Registro de publicação validada e deploy do site.

Release-please cria a GitHub Release antes do publish npm. Isso não será apresentado como confirmação de distribuição: o workflow e um artefato `publication.json` distinguem publicação pendente de publicação verificada. Não prometer transação atômica entre GitHub, npm e Vercel.

Invariantes: tag `v<version>` = manifest = `aik --version`; canal `next` somente para beta, `latest` somente para estável; pacote público e repository corretos; tag alcançável por main; nenhum publish de HEAD arbitrário via input manual; versão existente nunca sobrescrita.

Bootstrap: npm exige pacote existente para configurar trusted publisher. A primeira beta real será empacotada/validada na CI e publicada pelo mantenedor com autenticação interativa, sem pacote vazio nem versão fictícia. Depois, configurar OIDC e comprovar automação com a próxima beta contendo uma mudança real. Registrar a exceção de provenance no bootstrap local, se aplicável; não alegar provenance sem consultá-la.

## 3. Identidades e governança

GitHub App: contents, pull requests e issues com escrita para release-please; metadata leitura. Não conceder administration nem bypass de regras. Criar tokens de instalação curtos em job que não executa código de PR.

Publicação npm: runner hospedado GitHub, Node 24, npm compatível com OIDC (mínimo atual 11.5.1), `id-token: write` somente no job de publish; trusted publisher ligado ao workflow `release.yml` e environment `npm`. Permitir explicitamente `npm publish` no cadastro atual do npm, em vez de staging que exigiria outra aprovação por versão.

Main: PR obrigatório, zero aprovações externas, conversas resolvidas, checks estáveis, branch atualizada, histórico linear; bloquear exclusão e force push; auto-merge desligado. Não habilitar regra antes de observar seus checks numa PR real. Regras de tags `v*` impedem atualização/exclusão, sem impedir criação pelo bot.

CI de PR é leitura e não recebe secrets de publicação. Review do título em vez de exigir que todos os commits intermediários estejam formatados, pois o histórico final usa squash. Workflows devem tratar entradas como dados via variáveis de ambiente, não interpolar texto de PR em shell.

OSS: MIT mantida; CONTRIBUTING, SECURITY com private vulnerability reporting e suporte best effort, código de conduta com canal privado funcional, templates de issue/PR, changelog do core. Sem SLA fictício, aprovação externa obrigatória ou documentos que prometam suporte inexistente.

## 4. Website e documentação publicada

Configurar Vercel para o monorepo e validar a atribuição do nome. Um HTTP 404 `DEPLOYMENT_NOT_FOUND` não comprova disponibilidade. Se a plataforma rejeitar o nome, obter escolha do mantenedor; não comprar domínio nem escolher outro silenciosamente.

Previews via integração Git da Vercel. Produção somente por pipeline controlado; desabilitar publicação automática de main pela integração Git para evitar a corrida com npm. Previews não recebem secrets npm/App nem dados do Agamenon.

Deploy de release constrói o SHA da release e só segue após smoke npm. Website-only constrói o SHA da main com CI aprovada e usa a última publicação **validada**, não apenas `package.json` local ou um `latest` não verificado. Toda promoção registra `siteSha`, `packageVersion`, `releaseTag` e canal. Produção estável não é substituída pela recomendação beta posterior.

Evitar regressão por corrida: todos os caminhos usam um único promotor de produção, serializado; revalidar SHA e metadados imediatamente antes da promoção. Não promover um candidato antigo que substituiria uma atualização mais recente do site; reconstruir o candidato adequado com a versão publicada. Não basta `concurrency` porque a ordem da fila não é garantida.

Documentação de funcionalidade ainda não publicada permanece em preview. Antes de cada deploy, executar exemplos contra a versão npm selecionada. Revisão editorial complementa os testes: comandos válidos não provam explicações claras.

Quickstart: instalação local → obter/adaptar manifests → check → significado do relatório → CI com `--strict`. Guia de desenvolvimento separado. Explicar pass/0, fail/1, unknown/0 sem strict, unknown/2 com strict e entrada inválida/2. Não usar `npx aik` como instalação implícita do pacote homônimo do registry.

## 5. Agamenon

Usar o checkout atual por solicitação explícita; não criar cópia/worktree adicional. Registrar status/diff/HEAD antes de modificar e preservar trabalho preexistente. Não imprimir `.env`, tokens ou cabeçalhos de autenticação. A autorização de usar os ambientes existentes não autoriza apagar dados ou executar indiscriminadamente toda suíte live.

Backend e frontend mantêm schemas independentes de getWeather. Extrair schemas para módulos puros dentro de cada aplicação, reutilizados pela implementação original e pelo exportador de manifests. Não colocar ambos em um único schema compartilhado, o que esconderia drift.

Dois níveis de evidência:

- Distribuição e contrato: pacote npm exato, integridade, binário instalado, manifests gerados dos schemas reais, baseline pass, mudança incompatível temperature number→string detectada, unknown estrito, restauração pass.
- Runtime: browser no frontend atual, backend configurado, LLM e Open-Meteo reais, chamada getWeather e card renderizado. Não exigir temperatura fixa. Usar uma conversa identificável de teste e poucas tentativas; não repetir indefinidamente diante de falha externa.

A mutação incompatível ficará num teste derivado dos schemas reais e, para o experimento de runtime quando necessário, em edição temporária delimitada e restaurada. Não deixar código de produção quebrado nem modos de teste expostos à aplicação publicada. O resultado do contrato não substitui evidência do runtime.

## 6. Critérios de conclusão

- PR real de release gerado pela App recebe todos os checks obrigatórios.
- Main realmente protegida, com configuração exportada como evidência.
- Beta disponível em next, CLI e imports funcionam em instalação limpa.
- Segunda publicação por OIDC comprovada; sem token npm permanente.
- Tentativa de executar release para branch/tag divergente falha antes de publish.
- Reexecução não tenta sobrescrever versão nem rebaixa dist-tag.
- Site público Vercel confirmado, previews funcionais e versionamento visível/coerente.
- Website-only deploy comprovado sem gerar versão npm.
- Agamenon passa nas duas camadas e permanece funcional após restauração.
- Promoção estável feita apenas após aprovação específica do PR pelo mantenedor.

## Referências consultadas

- https://github.com/googleapis/release-please/blob/main/docs/manifest-releaser.md
- https://github.com/googleapis/release-please/blob/main/docs/customizing.md
- https://github.com/googleapis/release-please/blob/main/src/versioning-strategies/prerelease.ts
- https://github.com/googleapis/release-please-action#outputs
- https://docs.npmjs.com/trusted-publishers/
- https://vercel.com/docs/cli
- https://vercel.com/docs/domains/working-with-domains
- https://github.com/semantic-release/semantic-release/blob/master/.github/workflows/release.yml
- https://github.com/changesets/changesets/blob/main/.github/workflows/publish.yml

As referências demonstram abordagens reais, não uma alegação de popularidade ou de que todos esses projetos sejam mantidos por uma pessoa.
