# Plano de implementação — landing Editorial e monorepo

## Objetivo e decisões aprovadas

Criar a landing page do Agent Interaction Kit na direção visual **Editorial**, com predominância de imagens, logos oficiais do ecossistema e uma demonstração de contratos sincronizada ao scroll. Organizar site e biblioteca em um monorepo pnpm, preparar hospedagem na Vercel e entregar um PR para revisão.

Este documento é o plano; sua criação não inicia a implementação, publicação ou migração.

- Branch proposta: `codex/editorial-landing-monorepo`.
- Base: `origin/main` atualizada no início da execução.
- Um PR para `main`, com commits separados por etapa; não fazer merge automaticamente.
- Astro estático, TypeScript, Tailwind CSS, React apenas nas ilhas interativas, Motion e SVG.
- Identidade própria; shadcn/ui apenas nos controles que a página realmente precisar.
- pnpm workspaces, um lockfile, sem Turborepo inicialmente.
- Conteúdo público em inglês, como o README e a prévia aprovada; plano em português.
- Vercel com preview do PR; domínio próprio é uma configuração posterior à escolha e disponibilidade do nome.

## Referência visual aprovada

Direção 01 / Editorial da prévia revisada: papel claro, tinta verde escura, títulos grandes com destaque serifado, logos e uma interface ilustrada na primeira dobra. Preservar o caráter visual; evitar transformar a página em documentação ou em uma grade de cartões genéricos.

Referência local desta conversa: `/Users/joaopiga/.codex/visualizations/2026/09/07/01a07db9-f61a-7141-bd1a-ae123bf38f94/aik-visual-directions.html`. Este caminho é referência auxiliar, não dependência de build. O plano contém as decisões necessárias para execução em outro checkout.

Tokens iniciais a validar por contraste:

| Token | Valor inicial | Uso |
| --- | --- | --- |
| background | `#f8f9f5` | Papel claro |
| foreground | `#192d29` | Títulos e texto |
| primary | `#176951` | Ações e destaques |
| muted-foreground | `#66746d` | Texto secundário |
| border | `#d9e0d8` | Divisórias |
| card | `#ffffff` | Superfícies |
| muted | `#eef2e8` | Fundo da demonstração |
| destructive | `#ac4537` | Incompatibilidade |

Tipografia proposta: Inter para interface, Source Serif 4 em destaques editoriais e uma fonte mono de sistema para código. Hospedar os arquivos de fonte necessários, com licenças, subset e `font-display: swap`. Base de espaçamento de 4 px; superfícies com raio inicial de 12 px. Mapear tokens semânticos para Tailwind e shadcn, incluindo foco, estados, foregrounds de botões e sucesso/indeterminado. Não criar pacote compartilhado de UI enquanto só houver um consumidor.

## 1. Preparar a base e a branch

- [ ] Ler instruções aplicáveis do repositório e verificar alterações locais antes de qualquer mudança.
- [ ] Consultar no GitHub o estado dos PRs relacionados às issues #2–#6; não presumir que foram integrados a partir da `main` local.
- [ ] Preferir iniciar a migração após a integração desses PRs. Se ainda estiverem abertos, registrar a dependência e resolver a base antes de mover os arquivos afetados; não integrá-los automaticamente.
- [ ] Atualizar refs e criar a branch proposta em um worktree dedicado a partir da base confirmada, preservando a sessão na `main`.
- [ ] Registrar o SHA de base, a versão de Node/pnpm e executar os checks existentes como baseline.
- [ ] Fixar versões estáveis compatíveis da stack no lockfile; considerar os requisitos de Node do Astro escolhido separadamente da matriz de suporte do core.

Entrega: branch isolada e baseline conhecido.

## 2. Migrar para pnpm workspaces sem alterar a API pública

Estrutura final:

```text
apps/website/
  public/brands/
  src/components/ui/
  src/components/landing/
  src/data/
  src/layouts/
  src/pages/index.astro
  src/pages/docs/index.astro
  src/styles/
  tests/
  astro.config.mjs
  components.json
  package.json
  tsconfig.json
packages/core/
  src/
  bin/
  tests/
  package.json
  tsup.config.ts
  vitest.config.ts
  tsconfig.json
  README.md
  LICENSE
docs/
skills/
.github/
package.json
pnpm-workspace.yaml
pnpm-lock.yaml
biome.json
README.md
LICENSE
```

- [ ] Tornar o pacote raiz privado, com nome distinto; criar `pnpm-workspace.yaml` para `apps/*` e `packages/*`.
- [ ] Mover código, CLI, testes e configurações específicas para `packages/core` com mudanças mecânicas separadas das funcionais.
- [ ] Preservar nome npm `@agent-interaction-kit/core`, versão, subpath exports, tipos, binário `aik`, comportamento e formato dos relatórios.
- [ ] Distribuir dependências por proprietário: runtime do core no core; Astro/React/Motion no site; ferramentas globais na raiz quando apropriado.
- [ ] Manter README e licença no pacote publicado; revisar links relativos, fixtures, caminhos de testes e instruções das skills após a movimentação.
- [ ] Criar scripts raiz previsíveis: `dev:web`, `build`, `build:core`, `build:web`, `test`, `typecheck`, `check` e `test:web`.
- [ ] Usar scripts filtrados por nome de pacote; não usar flags que silenciem a ausência de checks obrigatórios.
- [ ] Atualizar ignores para saídas aninhadas, `.astro`, `.vercel` e resultados de testes.
- [ ] Adaptar CI, Knip, Dependabot e release que existirem na base. O release publica somente `packages/core`; raiz e website permanecem privados.
- [ ] Verificar `pnpm install --frozen-lockfile`, testes e build do core; gerar tarball real em diretório temporário e inspecionar conteúdo.
- [ ] Instalar o tarball em projeto temporário para testar imports públicos e CLI com fixtures pass/fail/unknown, incluindo `--strict` conforme o comportamento real.

Aceite: a reorganização não altera o contrato público do pacote nem inclui o site no artefato npm.

## 3. Construir a base visual e os assets

- [ ] Criar `@agent-interaction-kit/website` privado, com Astro em saída estática e integração React.
- [ ] Configurar Tailwind e aliases seguindo a integração compatível com as versões instaladas.
- [ ] Implementar tokens semânticos próprios e componentes Astro para conteúdo estático.
- [ ] Adicionar apenas os componentes shadcn necessários, por exemplo abas do quickstart e menu mobile. Evitar hidratar links/botões estáticos sem necessidade.
- [ ] Resolver formatação de `.astro` explicitamente: preservar Biome para arquivos suportados; usar formatter com suporte Astro caso a versão existente não cubra esse formato.
- [ ] Incorporar assets oficiais de AG-UI, Mastra e Microsoft Agent Framework e registrar URL, revisão/data, licença ou diretriz de uso em `public/brands/README.md`.
- [ ] Preservar proporções e identidade dos logos; só adicionar outras marcas quando tiverem papel claro no exemplo.
- [ ] Usar logos para contexto do ecossistema, sem sugerir clientes, parceria ou adaptadores oficiais inexistentes.
- [ ] Criar ilustração própria vetorial da interface de pedidos/fones de ouvido, com tamanhos reservados para evitar layout shift.

Aceite: primeira dobra reconhecível como a Editorial revisada, com logos legíveis e ilustração predominante. Não implementar as outras duas direções nem seletor de tema no produto.

## 4. Implementar a landing e o quickstart

- [ ] Header compacto com identidade AIK, Docs e GitHub; navegação funcional.
- [ ] Hero: “Agents change. Keep your UI in sync.”, uma frase de apoio e duas ações: começar e GitHub.
- [ ] Cena visual com frameworks no backend, AG-UI no caminho da interação e interface ilustrada. O AIK aparece separado, verificando os manifestos no CI, não como proxy do tráfego.
- [ ] Seção principal com demonstração animada conforme a etapa 5.
- [ ] Seção curta “Two manifests. One check.” com exemplo utilizável e comando de cópia.
- [ ] `/docs` inicial com instalação, exemplo dos dois manifestos, execução, interpretação dos estados e CI. Reutilizar conteúdo verificado; não criar portal completo de documentação neste PR.
- [ ] Conferir disponibilidade e nome real do pacote publicado antes de apresentar instalação npm. Enquanto não publicado, fornecer instrução de checkout/build que funcione.
- [ ] Validar a invocação do binário do pacote scoped. Preferir `pnpm exec aik` após instalação local ou `npx --package @agent-interaction-kit/core aik …`; não depender de `npx aik` como se fosse o nome do pacote.
- [ ] Footer simples com repositório, documentação e licença. Não adicionar métricas, clientes ou depoimentos fictícios.
- [ ] Configurar título, descrição, favicon, imagem Open Graph, sitemap e canonical usando a URL de produção configurada; previews sem indexação e sem canonicals fictícios.

Aceite: o propósito do produto pode ser entendido pela primeira dobra e pela demonstração; texto longo fica no quickstart.

## 5. Implementar a narrativa de scroll

Uma ilha React com Motion (`useScroll`/`useTransform`) e SVG, usando uma seção sticky e o scroll nativo da página. A versão final não utiliza o scroll interno da prévia.

| Momento | Imagem/movimento | Mensagem curta |
| --- | --- | --- |
| 1. Drift | `total` vira `amount`; preço da UI fica ausente | HTTP 200 ≠ compatible |
| 2. Check | Manifestos se aproximam do AIK; campo esperado é destacado | Breaking contract detected |
| 3. Correção | Alteração explícita do desenvolvedor restaura `total` | Fix the contract |
| 4. Compatível | Nova verificação confirma o campo e o card exibe o preço | Contracts in sync |

- [ ] Construir estados a partir de fixtures válidas dos manifestos AIK; validar pass/fail/unknown com o core durante build/testes, sem enviar o CLI ou suas dependências Node ao navegador.
- [ ] Se houver dependência de workspace para essa validação, declará-la explicitamente e garantir build do core antes da validação do site.
- [ ] Usar diagnósticos reais das fixtures, sem inventar códigos. Mostrar `unknown` em exemplo secundário como resultado inconclusivo, não como sucesso; explicar `--strict`.
- [ ] Animar principalmente `transform` e `opacity`; evitar scroll hijacking, canvas/3D e efeitos que não ajudam a explicar a comparação.
- [ ] Parar loops fora da viewport e suspender animações com `prefers-reduced-motion`.
- [ ] Oferecer composição estática legível sem JS e sequência empilhada no mobile/reduced motion, sem exigir uma longa rolagem vazia.
- [ ] Garantir estados reversíveis ao rolar para cima e entrada correta ao abrir a página no meio da seção.
- [ ] Não anunciar atualizações a cada frame para leitores de tela; oferecer descrição estática equivalente e status apenas nas mudanças relevantes.

Aceite: a narrativa mostra detecção antes do deploy e uma correção humana, sem afirmar que o AIK conserta código ou garante todo o comportamento da aplicação.

## 6. Validar e adaptar o CI

- [ ] Rodar checks da raiz e jobs independentes para core/site. Preservar a matriz de Node/OS do core que estiver na base; usar Node compatível com Astro no job web.
- [ ] Testes de navegador com Playwright cobrindo links principais, copiar comando, menu/abas quando presentes, estados da demonstração e modo de movimento reduzido.
- [ ] Validar visualmente em 360, 390, 768, 1024 e 1440 px; verificar teclado, zoom, foco, contraste, imagens e ausência de overflow horizontal.
- [ ] Executar análise automatizada de acessibilidade e inspeção manual dos elementos interativos.
- [ ] Medir build de produção, não servidor de desenvolvimento. Metas iniciais: Lighthouse mobile performance ≥90 e accessibility ≥95, com ambiente registrado; CLS ≤0,1 em laboratório. Resultados de laboratório não substituem métricas reais de usuários.
- [ ] Inspecionar peso de JS, fontes e imagens; hidratar só as ilhas necessárias e reduzir assets quando as metas não forem atingidas.
- [ ] Confirmar tarball npm, imports e CLI após a migração final.

Entrega: checks verdes e capturas desktop/mobile anexadas ao PR; registrar limitações reais, se houver.

## 7. Preparar Vercel e domínio

- [ ] Configurar projeto Vercel vinculado ao repositório, preset Astro e Root Directory `apps/website`.
- [ ] Usar o lockfile da raiz e instalação pnpm congelada. Confirmar acesso aos arquivos externos à Root Directory quando o build usar o workspace core.
- [ ] Build executa o script do website e suas dependências necessárias; diretório de saída estático `dist` relativo ao website. Validar em um preview real, sem presumir configuração de paths.
- [ ] Definir `main` como branch de produção e validar preview do PR, HTTPS, rotas e metadados. Não promover manualmente o PR para produção.
- [ ] Documentar configurações em `docs/deployment/website.md`, incluindo a URL pública usada pelo Astro, sitemap e Open Graph. Não versionar credenciais ou `.vercel`.
- [ ] Se acesso à conta Vercel não estiver disponível, abrir o PR com build local validado e registrar a conexão como pendência externa, sem declarar preview concluído.
- [ ] Começar pelo endereço atribuído `*.vercel.app`. `agentinteractionkit.dev` é apenas candidato: disponibilidade e aquisição ainda não foram verificadas.
- [ ] Após a escolha/posse do domínio, adicionar o apex na Vercel e aplicar os registros DNS exatos solicitados pelo painel; `www` redireciona ao apex. Verificar HTTPS, redirects, canonical e sitemap novamente.

O domínio próprio não bloqueia o PR. Sua compra e o merge/publicação em produção são passos posteriores; o plano não pressupõe que já ocorreram.

## 8. Entregar a branch e abrir o PR

Sequência sugerida de commits:

1. `chore(repo): migrate core to pnpm workspaces`
2. `feat(web): add editorial design system and landing`
3. `feat(web): animate contract compatibility story`
4. `test(web): validate landing and workspace builds`
5. `chore(web): document Vercel deployment`

- [ ] Revisar diff, arquivos movidos, artefatos gerados e ausência de segredos.
- [ ] Atualizar a branch com a base se necessário, resolvendo conflitos e repetindo apenas as verificações afetadas.
- [ ] Publicar a branch e abrir PR para `main` com título `feat(web): add editorial landing and pnpm monorepo`.
- [ ] Incluir problema resolvido, estrutura final, preservação da API/CLI, capturas, preview quando disponível, evidências de validação e pendências externas.
- [ ] Aguardar checks do PR, corrigir falhas relacionadas à entrega e fornecer link final para revisão.

## Critérios finais de conclusão

- [ ] Monorepo funcional; pacote core mantém contrato público e publicação isolada.
- [ ] Editorial fiel à direção aprovada, pouco texto, logos oficiais e demonstração visual correta.
- [ ] Página responsiva e acessível, com alternativas sem movimento e sem JS.
- [ ] Docs iniciais e CTAs funcionais; comandos testados contra o pacote real.
- [ ] CI verde e build de produção validado.
- [ ] PR aberto e preview Vercel validado ou bloqueio de acesso explicitamente identificado.

## Referências técnicas

- [pnpm workspaces](https://pnpm.io/workspaces)
- [Integração React no Astro](https://docs.astro.build/en/guides/integrations-guide/react/)
- [shadcn/ui com Astro](https://ui.shadcn.com/docs/installation/astro)
- [Motion e scroll](https://motion.dev/docs/react-scroll-animations)
- [Monorepos na Vercel](https://vercel.com/docs/monorepos)

Referências consultadas em 2026-09-07. Confirmar detalhes e versões na execução.
