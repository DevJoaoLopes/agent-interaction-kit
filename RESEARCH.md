# Agent Interaction Kit — Pesquisa inicial

> Registro histórico: prioridades, escopo e marcos deste documento foram substituídos pelo [plano vigente](PLAN.md) após os relatos sobre divergências de ferramentas entre backend e frontend. Preservado como fonte da pesquisa competitiva; não usar seu MVP como backlog atual.

> Contratos determinísticos de interação para frontends com agentes. AG-UI primeiro.

Status: proposta de produto fundamentada em pesquisa; ainda não é uma especificação de implementação fechada para lançamento.
Data da pesquisa: 06/09/2026. Idioma deste documento de planejamento: português brasileiro. Pasta do repositório: `agent-interaction-kit`.

**Política de idioma:** este plano de trabalho pode ser escrito em pt-BR. O projeto voltado à comunidade global deve usar inglês no código, nos identificadores, nas APIs, nas mensagens da ferramenta, nos exemplos públicos e na documentação pública. O nome **Agent Interaction Kit** permanece em inglês.

## Recomendação executiva

Não construir outro validador independente de streams AG-UI. Já existe uma implementação direta: **ag-ui-validate**. Começar validando se **cenários reutilizáveis de interação entre agente e frontend** economizam trabalho relevante de engenharia além do que esse validador e testes convencionais já oferecem.

O projeto proposto verifica uma promessa mais específica: dada uma interação declarada, as decisões do usuário, os eventos do agente, o estado do cliente e os efeitos observados são coerentes? Começar por aprovação/rejeição e pelo percurso de ida e volta do estado. Preferir contribuir com o corpus de testes e os adaptadores nos projetos de origem se um pacote separado agregar pouco valor.

O nome em inglês **Agent Interaction Kit** é provisório e descreve a fronteira testada sem sugerir certificação oficial do AG-UI. A disponibilidade no npm, PyPI, como organização no GitHub, domínio e marca permanece **desconhecida**. Criar esta pasta local não reserva o nome. “AG-UI Contract & Conformance Kit” permanece como hipótese original, não como posicionamento recomendado.

Nesta etapa, foi criado apenas este documento de planejamento. Não há implementação, dependências, aplicação ou publicação.

## Evidências e limites da pesquisa

- **Verificado:** observado em documentação primária, arquivos de repositórios, metadados de registros de pacotes ou na API do GitHub. Uma capacidade documentada é verificada como afirmação do projeto; seu funcionamento não foi medido de forma independente.
- **Relatado:** reprodução ou explicação apresentada pelo autor de uma issue. O status da issue é o observado, não uma prova de que o problema persiste na versão atual.
- **Hipótese:** necessidade de usuário ainda não comprovada, previsão de adoção ou lacuna arquitetural inferida.
- **Recomendação:** decisão proposta, sujeita a validação.
- **Desconhecido:** informação indisponível ou não estabelecida nesta pesquisa. Desconhecido não significa zero ou inexistente.

As fontes foram consultadas em páginas públicas e por leitura de APIs públicas. O limite de requisições da API do GitHub impediu a conclusão de algumas consultas de releases e contribuidores. As páginas consultadas podem estar defasadas; valores exatos da API têm precedência sobre contagens arredondadas das páginas. Nenhum concorrente foi instalado ou executado. Nenhum mantenedor ou cliente foi contatado. Esta é uma análise competitiva direcionada, não um levantamento exaustivo ou uma auditoria formal.

O pedido de criação da pasta e do plano em Markdown autoriza esses arquivos, substituindo a restrição anterior de “não criar arquivos” presente no prompt citado. Não havia resposta à pergunta inicial de priorização durante a elaboração; por isso, a pesquisa definiu uma prioridade provisória. A orientação posterior do autor permite este plano em pt-BR, preservando o inglês como idioma do projeto público.

## Etapa 1 — O problema

### Uma fronteira concreta de falha

Um time atualiza o adaptador de um agente. A requisição funciona, todos os eventos podem ser interpretados e o assistente retorna um texto plausível. Porém, o navegador nunca recebe uma segunda solicitação de aprovação, uma edição do usuário desaparece na execução seguinte ou a interface exibe conclusão apesar de uma falha na gravação. Os testes unitários do backend e as avaliações da qualidade das respostas podem passar mesmo assim.

Os usuários afetados são engenheiros de frontend que implementam interações com agentes, mantenedores de integrações que traduzem eventos de runtimes e engenheiros de plataforma responsáveis por atualizações de dependências e CI. A tarefa imediata é: **fazer um teste pequeno e reproduzível comprovar que uma interação continua funcionando em uma combinação específica de cliente e runtime.**

É necessário separar três fronteiras:

| Fronteira | O que permite estabelecer | O que não permite estabelecer isoladamente |
| --- | --- | --- |
| Payload do evento | Tipos e campos obrigatórios correspondem a um schema de versão fixada | Sequência correta, comportamento real da interface e efeitos executados |
| Sessão AG-UI | Ciclo de vida, relações entre mensagens e ferramentas, estado reconstruído  | Se uma aprovação foi realmente exibida ou uma gravação no banco ocorreu |
| Interação instrumentada | Decisões, observações de estado e registros de efeitos satisfazem um contrato da aplicação | Segurança universal do agente ou comportamento fora do cenário observado |

### Evidências de um problema, sem justificar automaticamente um novo produto

| Evidência primária | Relato observado | Implicação para o produto |
| --- | --- | --- |
| [AG-UI #1938](https://github.com/ag-ui-protocol/ag-ui/issues/1938), aberta na página consultada | Adaptador A2A descarta o estado de entrada; há uma proposta de correção vinculada | Um stream de saída válido ainda pode perder o contexto enviado pela interface |
| [AG-UI #2091](https://github.com/ag-ui-protocol/ag-ui/issues/2091), aberta na página consultada | Desenvolvedor não consegue estabelecer estado bidirecional através de uma fronteira entre múltiplos agentes | O contrato precisa observar a entrega da entrada e os patches de saída |
| [AG-UI #1346](https://github.com/ag-ui-protocol/ag-ui/issues/1346), fechada | Relato de falhas em chamadas paralelas de ferramentas do frontend e no tratamento dos resultados na integração Strands | Usar como fixture histórica de regressão, sem afirmar que o defeito continua presente |
| [AG-UI #1720](https://github.com/ag-ui-protocol/ag-ui/issues/1720), aberta na página consultada | Compactação de estado perde o estado anterior entre lotes | Sintaxe válida de JSON Patch é uma garantia mais fraca que a atualização correta do estado do cliente |
| [AG-UI #2463](https://github.com/ag-ui-protocol/ag-ui/issues/2463) | Relato de que o adaptador LangGraph omite argumentos retornados de uma só vez | Variações na divisão em fragmentos não deveriam alterar silenciosamente a invocação final |

Esses relatos estabelecem classes concretas de falhas. Sua frequência, seu custo para os times e a disposição de adotar outra dependência continuam sendo hipóteses.

### Evidências fortes contra a hipótese original

O projeto oficial já fornece SDKs, schemas de validação em tempo de execução, integrações e uma suíte de testes do Dojo. O [diretório E2E do Dojo](https://github.com/ag-ui-protocol/ag-ui/tree/main/apps/dojo/e2e) inclui testes Playwright, fixtures, geradores de relatórios e configuração de mocks. Seu README descreve testes básicos agendados das demonstrações. É incorreto afirmar que o AG-UI não tem testes.

O projeto comunitário [ag-ui-validate](https://github.com/langport-dev/ag-ui-validate) documenta um validador puro, CLI, entrada por endpoint ou gravação, integração com Vitest, relatórios para CI e uma versão Python com corpus compartilhado. Isso cobre uma parte substancial do MVP de conformidade originalmente proposto. Números pequenos de adoção não eliminam essa sobreposição.

Testes convencionais com Vitest/Playwright podem ser a melhor solução para uma aplicação isolada. Uma nova biblioteca só se justifica se seus cenários e diagnósticos forem reutilizáveis entre times e reduzirem significativamente o código de adaptação e testes.

### O que o Agamenon efetivamente oferece

Os arquivos locais foram lidos, mas não executados:

| Arquivo no repositório Agamenon | Comportamento observado | Cenário experimental útil |
| --- | --- | --- |
| `apps/backend/src/mastra/agents/agamenon.ts` | Agente Mastra com ferramenta de clima, memória e instruções para ferramentas do frontend | Separar decisões do modelo do comportamento do runtime/cliente usando saídas predeterminadas |
| `apps/backend/src/copilotkit.ts` | CopilotRuntime obtém agentes Mastra locais por meio da integração AG-UI | Verificar o comportamento após atualizações do adaptador |
| `apps/frontend/src/components/SaveNoteApproval.tsx` | Callback de aprovação chama `saveNote` e responde com texto de sucesso ou falha; rejeição responde sem chamá-lo | Rejeição significa zero gravações; sucesso sucede um efeito confirmado; submissões duplicadas precisam de um cenário |
| `apps/backend/src/routes/notes.ts` | Valida a entrada e insere uma linha; não há evidência de aprovação ou verificação de idempotência visível nessa rota | Usar uma fronteira simulada de efeitos; não confundir um botão no frontend com aplicação da regra no servidor |
| `apps/frontend/src/components/ChecklistPanel.tsx` | Assina e renderiza o estado do agente; não há callback de edição nesse componente | A atualização servidor → cliente é visível; edição bidirecional não foi demonstrada aqui |
| `apps/backend/src/routes/threads.ts` | Lista conversas e recupera mensagens | Testar mapeamento de identidades e continuação com base no histórico |
| `apps/frontend/src/components/ThreadSidebar.tsx` | Carrega/seleciona conversas e protege contra resposta assíncrona após limpeza do efeito | Testar eventos atrasados após uma troca de conversa |
| `README.md` | Descreve streaming, estado compartilhado, HITL, ferramentas, persistência e testes | Fonte de cenários candidatos, não prova de execução bem-sucedida |

Possíveis gravações duplicadas e contorno da aprovação são hipóteses de inspeção, não problemas reproduzidos. Esta tarefa não altera o Agamenon. Sua interface em português e seu armazenamento persistente pertencem a um exemplo opcional de integração, não ao núcleo do kit ou à identidade do produto.

## Cenário competitivo

### Métricas dos repositórios

Retrato consultado em 06/09/2026. “Linguagem” é a linguagem principal indicada pelo GitHub quando disponível, não o conjunto completo de linguagens suportadas. “Contribuidores” conta as entradas retornadas, incluindo contribuidores anônimos; não corresponde ao número de mantenedores ativos. Contagens que exigiam paginação não concluída são desconhecidas. O último push indica atividade no repositório, não necessariamente uma alteração de código incorporada. Release é a entrada mais recente retornada pelo endpoint de releases, não uma afirmação sobre todos os pacotes de um monorepo.

Nas linhas baseadas na API, as métricas vêm da API pública do repositório, dos endpoints de contribuidores e releases e da busca de issues com `is:issue is:open`, excluindo pull requests. Os links da primeira coluna identificam os repositórios públicos; o [padrão de consulta da API do GitHub](https://api.github.com/repos/ag-ui-protocol/ag-ui) pode ser reproduzido substituindo proprietário/repositório. Valores provenientes de páginas estão identificados explicitamente.

| Projeto / URL | Linguagem | Stars | Forks | Contribuidores | Última release verificada | Issues abertas | Último push (UTC) | Licença |
| --- | --- | ---: | ---: | --- | --- | ---: | --- | --- |
| [AG-UI](https://github.com/ag-ui-protocol/ag-ui) | Python; também TS e outros SDKs | 15.749 | 1.418 | Desconhecido | release/2026-08-31, 31/08 | 211 | 06/09, 17:53:47 | MIT |
| [ag-ui-validate](https://github.com/langport-dev/ag-ui-validate) | Python; também TS | 2 | 0 | 2 | v0.4.0, 29/08 | 0 | 29/08, 07:14:39 | MIT |
| [AgentAssert ABC](https://github.com/qualixar/agentassert-abc) | Python | 5 | 1 | 2 | v0.7.0, 12/08 | 0 | 19/08, 18:49:03 | AGPL-3.0 na API; README especifica or-later e licenciamento comercial |
| [AgentAssert — Kaushik Dhola](https://github.com/kaushikdhola/agentassert) | Python (PyPI) | Desconhecido | Desconhecido | Desconhecido | PyPI 0.1.1, 29/03; GitHub desconhecido | Desconhecido | Desconhecido | MIT (PyPI) |
| [Runledger](https://github.com/runledger/Runledger) | Python | 2 | 0 | 1 | v0.1.1, 26/12/2025 | 0 | 15/01, 03:12:45 | MIT |
| [Phoenix](https://github.com/Arize-ai/phoenix) | Python | 11.346 | 1.111 | Desconhecido | Desconhecido | 843 | 06/09, 20:20:47 | Elastic License 2.0, verificada no README; API NOASSERTION |
| [Laminar](https://github.com/lmnr-ai/lmnr) | TypeScript | 3.230 | 236 | 30 | Desconhecido | 37 | 06/09, 21:44:01 | Apache-2.0 |
| [OpenLIT](https://github.com/openlit/openlit) | TypeScript | 2.743 | 371 | Desconhecido | Desconhecido | 33 | 04/09, 05:20:45 | Apache-2.0 |
| [MLflow](https://github.com/mlflow/mlflow) | Python | 27.837 | 6.256 | Desconhecido | Desconhecido | 1.466 | 06/09, 23:43:17 | Apache-2.0 |
| [EvalPort](https://github.com/adhabnr-ux/evalport) | SDK Python documentado; principal desconhecida | 6 (página) | 3 (página) | Desconhecido | Desconhecido | 2 | Desconhecido | Apache-2.0 (página) |
| [AgentReplay](https://github.com/anzal1/agentreplay) | Referência Node; SDKs Python/Go documentados; principal desconhecida | 3 (página) | 1 (página) | Desconhecido | Desconhecido | 0 (página) | Desconhecido | Desconhecida; existe arquivo LICENSE, mas seus termos não foram verificados |
| [A2A Inspector](https://github.com/a2aproject/a2a-inspector) | Python + TypeScript (README) | Desconhecido | 150 (página) | Desconhecido | Desconhecido | 23 (página) | Desconhecido | Apache-2.0 (página) |
| [MCP Inspector](https://github.com/modelcontextprotocol/inspector) | TypeScript/Node (README) | Desconhecido | Desconhecido | Desconhecido | Desconhecido | Desconhecido | Desconhecido | Desconhecida no material revisado |

O limite da API explica os dados ausentes, não a inatividade dos projetos. O push de janeiro do Runledger evidencia um intervalo maior de atividade no repositório, mas não estabelece abandono. Zero issues em projetos muito pequenos não é evidência de que as necessidades dos usuários estejam plenamente atendidas. Os totais de releases são desconhecidos; as últimas releases foram informadas quando verificadas. Datas sem ano na tabela referem-se a 2026.

### Capacidades, sobreposição e lacunas

Todas as afirmações de lacunas abaixo são inferências arquiteturais a partir do material revisado, exceto quando vinculadas a uma issue. “Não documentado” nunca significa tecnicamente impossível. Ferramentas genéricas de avaliação podem executar verificações determinísticas personalizadas; não devem ser reduzidas a avaliadores com LLM ou dashboards.

| Projeto | Proposta verificada | Sobreposição | Lacuna inferida / implicação |
| --- | --- | --- | --- |
| [AG-UI oficial](https://github.com/ag-ui-protocol/ag-ui) | Protocolo, SDKs e ecossistema de integrações | Base muito próxima; infraestrutura de testes existente | Testes reutilizáveis independentes da interface de demonstração podem ajudar, mas contribuir no projeto de origem pode ser a melhor solução |
| [Pacote core oficial](https://www.npmjs.com/package/@ag-ui/core) | Tipos e schemas em tempo de execução | Validação de payload | Aceitação pelo schema, isoladamente, não estabelece uma relação entre decisão e efeito da aplicação |
| [ag-ui-validate](https://github.com/langport-dev/ag-ui-validate) | Diagnósticos de conformidade sobre streams ao vivo ou gravados | Quase total com a ideia original de validador | A documentação revisada se concentra em streams; conduzir escolhas humanas e observar efeitos independentemente é a fronteira adjacente proposta, sujeita a verificação no código-fonte |
| [AgentAssert no PyPI](https://pypi.org/project/agentassert/) | Testes comportamentais em Python, mocks de ferramentas, expectativas de invocação/ordem e CI | Alta para comportamento genérico de agentes | Nenhum perfil de interação AG-UI/frontend foi verificado. O repositório público não pôde ser recuperado; maturidade incerta |
| [AgentAssert ABC](https://github.com/qualixar/agentassert-abc) | DSL de contratos comportamentais e aplicação de regras em tempo de execução | Contratos e restrições | Governança/aplicação de regras é outra fronteira; as alegações de garantias formais não foram avaliadas independentemente. Não confundir com o outro AgentAssert |
| [Runledger](https://github.com/runledger/Runledger) | CI determinístico para agentes por gravação/reexecução, contratos de ferramentas e limites de consumo | Alta para CI, cenários e bloqueio de regressões | A interface própria de agentes por subprocesso não fornece, por si só, um modelo de observação do cliente AG-UI |
| [Phoenix](https://github.com/Arize-ai/phoenix) | Tracing, avaliações, conjuntos de dados e experimentos | Pode armazenar e avaliar evidências relevantes | Decisões da interface exigem instrumentação adequada; nenhuma suíte pronta de interação AG-UI foi verificada. A licença do repositório é ELv2; não presumir uma dependência permissiva irrestrita |
| [Laminar](https://github.com/lmnr-ai/lmnr) | Observabilidade de agentes com instrumentação de clientes | Diagnóstico e avaliações | Poderia consumir os resultados; sua plataforma documentada não corresponde ao pacote proposto de contratos de interação sem interface gráfica |
| [OpenLIT](https://github.com/openlit/openlit) | Observabilidade OTel, avaliações e recursos de engenharia | Captura de falhas e verificações personalizadas | Telemetria genérica não reconstrói automaticamente uma sessão AG-UI de versão fixada junto às ações do cliente |
| [MLflow](https://github.com/mlflow/mlflow) | Ferramentas de experimentação, avaliação, monitoramento e ciclo de vida de IA | Avaliadores personalizados e CI podem cobrir asserções | Preferir integração se os usuários já o utilizarem; a semântica de interação AG-UI ainda exige instrumentação específica |
| [EvalPort](https://github.com/adhabnr-ux/evalport) | Casos de avaliação, avaliadores, suítes e resultados portáveis | Portabilidade de testes/resultados | Não é principalmente uma plataforma de observabilidade. Seu formato de intercâmbio não estabelece o agendamento de interações bidirecionais |
| [AgentReplay](https://github.com/anzal1/agentreplay) | Traces, aprovações, evidências de estado/efeitos, asserções determinísticas e critérios de aprovação | Alta, inclusive com a ideia reformulada | Uma biblioteca genérica de asserções de aprovação/efeito o duplicaria. Um projeto separado precisa provar valor na execução do frontend AG-UI e na atualização de estado do cliente, além de inspecionar traces |
| [A2A Inspector](https://github.com/a2aproject/a2a-inspector) | Interação web, verificações de Agent Card e depuração de protocolo | Referência de produto de inspeção | Fronteira A2A; não comprova ausência de ferramentas AG-UI |
| [MCP Inspector](https://github.com/modelcontextprotocol/inspector) | Inspeção de servidores MCP via web, CLI e terminal | Referência de invocação de ferramentas e fluxo do desenvolvedor | Verificações de servidores MCP não estabelecem o comportamento da interface AG-UI |

### SDKs, implementações comunitárias e terminologia equivalente

A [árvore oficial de SDKs](https://github.com/ag-ui-protocol/ag-ui/tree/main/sdks) e as integrações são o primeiro inventário de compatibilidade. Fixar versões dos pacotes individualmente; uma release do repositório não é uma versão universal do protocolo. TypeScript e Python devem ser avaliados por meio dos adaptadores reais, sem presumir equivalência comportamental apenas porque compartilham nomes de eventos.

O pacote comunitário [ag_ui para Dart](https://pub.dev/packages/ag_ui) é uma implementação cliente candidata, não um produto concorrente de contratos. Ele demonstra que a validação não deve pressupor React. Métricas do repositório, número de contribuidores, histórico de releases, atividade e licença não foram integralmente verificados e permanecem desconhecidos; suporte a Dart não é um compromisso do MVP.

As buscas incluíram “agent contract testing”, “agent conformance testing”, “agent protocol testing”, “tool call testing” e “event stream validation”. Foram encontradas ferramentas de testes comportamentais e inspetores específicos de protocolo; a categoria não está vazia. [AgentRFC / AgentConform](https://arxiv.org/abs/2603.23801) descreve pesquisa de conformidade de segurança com cláusulas normativas, representações intermediárias tipadas e verificação de modelos. Sua distinção entre requisitos de protocolo e endurecimento adicional é relevante. Não foi verificada uma implementação utilizável para AG-UI nem as métricas/licença de um repositório associado; todas permanecem desconhecidas. Afirmações de pesquisa não são evidência de produto disponível.

A comparação competitiva mais forte é, portanto, **ag-ui-validate + Vitest/Playwright existentes + algumas fixtures da aplicação**, com AgentReplay como alternativa adicional para asserções de aprovação/efeito. Comparar o kit proposto com essa combinação antes de criar um framework genérico.

## Etapa 2 — Escopo e formato de entrega

### Dentro do escopo da versão alfa proposta

- Um corpus pequeno e portável de interações, com contratos explícitos de cenários.
- Execução de cenários sem interface gráfica, por meio de um adaptador com entradas e saídas observáveis.
- Contratos de aprovação/rejeição e de ida e volta do estado, com declaração das evidências obrigatórias.
- Importação de diagnósticos de conformidade AG-UI existentes por um provedor substituível.
- Fronteiras simuladas e determinísticas de modelos/ferramentas; a suíte principal não exige credenciais de modelos pagos.
- Resultados legíveis por máquina, evidências concisas das falhas e comportamento definido em CI.
- Um driver de referência independente de framework e um exemplo de integração derivado do Agamenon.

### Fora do escopo

Tracing/armazenamento em produção, replay de agentes como produto genérico, pontuação da qualidade de modelos, benchmarks de inteligência de agentes, autorização/aplicação de regras em tempo de execução, avaliação de qualidade visual, renderizador de interface generativa, novo framework de agentes, protocolo concorrente, certificação universal de segurança e funcionalidades de assistente pessoal do Agamenon.

Não há dashboard, login, cobrança, banco de dados, serviço hospedado ou servidor permanente de conformidade. Um servidor temporário de fixtures em localhost se justifica apenas nos testes de transporte. Instrumentar uma fronteira simulada de gravação não exige uma instância do Supabase.

### Possíveis extensões futuras

Fixtures Playwright para comportamento real do navegador; injeção de falhas de reconexão e cancelamento; mais adaptadores de runtimes; implementação Python usando o mesmo corpus; exportações opcionais de relatórios; negociação de capacidades; responsabilidade sobre estado em múltiplos agentes; protocolos adicionais apenas após demanda comprovada. Nenhum desses itens deve ser implicitamente prometido por um selo de suporte da versão alfa.

| Formato | Decisão | Motivo |
| --- | --- | --- |
| Biblioteca TypeScript | Primeira implementação recomendada, após validação | Executa junto aos clientes de frontend e permite um núcleo puro e portável |
| CLI | Entrada mínima para processamento offline e relatórios na versão alfa | Facilita processamento de artefatos em CI; reutiliza o mesmo avaliador |
| Plugin Vitest | Adiar matcher próprio; fornecer exemplo de teste convencional | Evitar duplicar o matcher AG-UI existente e criar outro executor de testes |
| Plugin Playwright | Adiar; usar uma prova convencional no navegador se necessário | Evidência do navegador importa, mas um plugin não é necessário para demonstrá-la |
| Servidor de conformidade | Sem serviço persistente | Acrescenta complexidade de implantação sem estabelecer semântica adicional |
| Aplicação web | Não | Inspecionar primeiro os relatórios de CI e as saídas de testes existentes |

## Etapa 3 — Casos de uso e limites das comprovações

| Caso de uso | Ação de teste e observação | Resultado esperado / fase |
| --- | --- | --- |
| Validar um agente em CI | Executar interação determinística e passar seu stream ao provedor de conformidade existente | Resultados de protocolo e contrato separados; alfa |
| Nova implementação AG-UI | Executar casos compartilhados contra adaptador fornecido pelo implementador | Relatar capacidades suportadas e casos que falharam; sem certificação universal; driver de referência na alfa |
| Capturar stream inválido | Fornecer gravação sanitizada ao validador existente; preservar posições dos eventos no relatório combinado | Apontar ciclo de vida/patch malformado e regra de origem; importação na alfa |
| Aprovação humana | Rejeitar uma proposta de gravação de nota e processar todo o trabalho pendente do cenário; observar independentemente zero tentativas de efeito | Aprovar o teste somente com observação completa dos efeitos; alfa |
| Aprovação seguida de falha | Aprovar, injetar falha da ferramenta e verificar a observação de conclusão apresentada ao cliente | Não relatar sucesso para o efeito que falhou, conforme este contrato da aplicação; alfa |
| Regressão de protocolo | Comparar versões anterior/nova do adaptador com saídas predeterminadas e idênticas do modelo | Resultados dos contratos e perfis suportados, não texto gerado; alfa |
| Comparação de runtimes | Executar cenários equivalentes com capacidades idênticas | Matriz de capacidades; ausência de suporte não equivale a uma nota de falha; piloto de validação |
| Ida e volta do estado | Editar estado na interface, observar requisição seguinte e estado retornado, inspecionar estado efetivo do cliente | Nenhuma perda silenciosa dos campos declarados sob a política escolhida de mesclagem; alfa |
| Reconexão | Desconectar após a proposta, reconectar conforme semântica do adaptador e observar propostas/efeitos duplicados | Exige perfil de reconexão e evidência completa; futuro |
| Cancelamento | Solicitar interrupção; observar confirmação e efeitos pendentes dentro de um limite declarado | Distinguir interrupção local, parada no servidor e efeitos já confirmados; futuro |
| Troca de conversa | Entregar evento atrasado da conversa A após selecionar B | Não alterar o estado de B conforme o contrato da aplicação; futuro |

Não afirmar que toda chamada de ferramenta precisa ter um resultado na mesma execução. Ferramentas do frontend podem retornar uma mensagem de ferramenta em uma requisição posterior. `TOOL_CALL_END` encerra a transmissão da invocação; não é prova independente de que um efeito foi executado. Essas distinções seguem o [fluxo de ferramentas do AG-UI](https://docs.ag-ui.com/concepts/tools).

## Etapa 4 — Três abordagens de produto

As estimativas de esforço pressupõem um mantenedor experiente, perfil de protocolo com versão fixada, respostas predeterminadas do modelo e ausência de hospedagem. São estimativas de planejamento, não compromissos de entrega medidos.

| Abordagem | Usuário principal e valor | Componentes | Vantagens | Limitações / concorrência | Esforço | Hipótese de adoção / diferencial defensável |
| --- | --- | --- | --- | --- | --- | --- |
| A. Corpus de interações nos projetos de origem | Mantenedores de adaptadores: exemplos reutilizáveis de sucesso e falha | Fixtures versionadas, receitas curtas e propostas de contribuição | Menor duplicação e manutenção; útil mesmo sem um novo pacote | Revisão dos mantenedores leva tempo; menor identidade de produto independente; baixo risco competitivo | 1–2 semanas para o corpus inicial | Alcance direcionado pelos mantenedores existentes; diferencial vem de casos confiáveis de regressão |
| B. Agent Interaction Kit | Times de frontend/plataforma: testar decisões do usuário, estado e efeitos entre clientes | Pequeno avaliador/API de drivers em TS, corpus, provedor de conformidade existente e CLI mínima | Adoção independente, integração com CI e fronteira clara no frontend | Custo dos adaptadores; sobreposição com AgentReplay e testes próprios; concorrência média/alta se a execução das interações não for reutilizável | 3–5 semanas após validação | Não comprovada; maior ativo seriam os mapeamentos semânticos entre clientes e o corpus de falhas mantido |
| C. Laboratório de compatibilidade | Fornecedores de runtimes: evidências compartilhadas de compatibilidade | Fixtures executáveis de servidor/cliente, infraestrutura de testes no navegador, agendador de falhas e executor da matriz | Comprovação ampla de interoperabilidade; potencial utilidade para qualificar releases | Alto custo de manutenção e risco de testes instáveis de transporte; compete com Dojo e fluxos de inspeção | 8–12+ semanas | Potencial valor para o ecossistema, mas alto custo de coordenação; manutenção contínua da matriz é o ativo |

**Recomendação:** usar A como etapa obrigatória de descoberta e construir B somente se reutilização e demanda externa forem demonstradas. Tratar C como colaboração futura com mantenedores de runtimes. Não construir B apenas para ter um repositório próprio. Se A resolver o problema, entregar A e encerrar essa expansão.

## Etapa 5 — Proposta de MVP pequeno

### Funcionalidades obrigatórias

1. Carregar e validar um contrato e um manifesto de fixture versionados.
2. Avaliar evidências de interação coletadas sem I/O ou LLM.
3. Executar cenários limitados usando driver injetado, relógio virtual, IDs determinísticos e observador simulado de efeitos.
4. Importar diagnósticos de um provedor de conformidade AG-UI com versão fixada; preservar IDs de regras e proveniência originais.
5. Avaliar quatro tipos iniciais de contrato: effect-after-approval, rejection-without-effect, client-state-roundtrip e effect-failure-without-success-projection.
6. Emitir resumo no terminal, relatório JSON estável e JUnit XML. Delegar validação e relatórios exclusivamente de protocolo ao validador existente sempre que viável.
7. Fornecer fixtures válidas, inválidas e com evidências insuficientes, além de um exemplo independente de framework e outro com Mastra/CopilotKit.

### Entradas e saídas

| Artefato | Formato e significado |
| --- | --- |
| Contrato | Documento JSON validado por JSON Schema publicado; predicados nomeados, sem strings executáveis |
| Manifesto de fixture | JSON com versão do schema, proveniência da fonte, perfil do protocolo, diagnósticos esperados, capacidades necessárias, estado inicial e limite de conclusão |
| Stream AG-UI | Sequência de eventos interpretados ou NDJSON importado; interpretação de SSE pertence inicialmente ao provedor existente |
| Evidência de interação | Envelopes NDJSON versionados para eventos do agente, requisições enviadas, decisões do usuário, observações de estado do cliente, tentativas/confirmações/falhas de efeitos e conclusão do cenário |
| Driver | Integração local confiável de teste em TypeScript; não é carregada de uma gravação não confiável |
| Relatório | JSON com resultado por camada, capacidades testadas, diagnósticos, asserções ignoradas/desconhecidas e metadados de versões |

Os eventos AG-UI originais permanecem inalterados. O envelope é um artefato de teste, não um novo protocolo de comunicação. Registros de evidência incluem sequência, fonte, direção, IDs de sessão/execução quando conhecidos, ID de correlação, localização na fonte e payload. Tentativas de efeitos e efeitos confirmados são fatos distintos. Capturar uma requisição comprova sua entrega na fronteira do adaptador; é necessária observação no servidor para comprovar recebimento além dessa fronteira.

### Responsabilidades propostas da API pública — ainda sem código

| Operação | Entrada → saída | Contrato |
| --- | --- | --- |
| `validateContract` | JSON não validado → contrato validado ou diagnósticos de configuração | Sem execução ou busca remota de schema |
| `evaluateInteraction` | Contrato + evidências + perfil → relatório | Pura e determinística |
| `runScenario` | Cenário + driver + relógio controlado → evidências e relatório | Trabalho limitado; liberação de recursos e classificação de falhas explícitas |
| `createAguiProvider` | Configuração com versão fixada de validador/perfil → provedor de verificações de protocolo | Preservar semântica e IDs do projeto de origem |
| `formatReport` | Relatório + seleção terminal/JSON/JUnit → saída serializada | Sem cálculo dos resultados |

Os nomes são propostas, não APIs publicadas. Uma CLI futura pode expor uma operação offline `check` sobre artefatos. A execução de cenários ao vivo fica inicialmente nos testes convencionais; não adicionar descoberta dinâmica de testes nem substituir o Vitest.

### Formato e semântica dos contratos

Campos obrigatórios do contrato: `schemaVersion`, `id`, `description`, `protocolProfile`, `requiredCapabilities`, `requiredEvidence`, `scope`, `completion` e `assertions`. Cada asserção contém `id`, `kind`, `selector`, `expectation`, `severity` e `provenance`.

Usar um conjunto inicial fechado de predicados: igualdade em um JSON Pointer explícito, predecessor causal obrigatório, efeito proibido e cardinalidade limitada. Evitar uma linguagem YAML universal ou predicados JavaScript arbitrários até que cenários reais os exijam.

Exemplo em prosa: **reject-note-write** exige uma proposta concluída de gravação de nota e uma rejeição correspondente à mesma conversa, chamada e versão imutável dos argumentos. Espera zero tentativas de gravação desde a criação da proposta até a conclusão do cenário. Um stream válido sem observação independente dos efeitos retorna **unknown**, não pass. Uma tentativa de gravação anterior à rejeição ainda é uma violação, pois nunca houve aprovação.

Uma aprovação se aplica a um escopo declarado de proposta, incluindo os argumentos. Alterar os argumentos invalida essa aprovação, a menos que o contrato da aplicação declare explicitamente outra regra. Essas são políticas da aplicação, não requisitos universais inventados para o AG-UI. Não inferir aprovação a partir de uma string em linguagem natural como “yes” ou “saved”.

### Camadas de validação e resultados

- Transporte/parser: bytes malformados, JSON inválido, posições na fonte e captura incompleta.
- Protocolo: verificações delegadas de schema, ciclo de vida, mensagens, ferramentas e estado para o perfil selecionado.
- Interação: relações declaradas de ordem, identidade, estado e efeitos.
- Cobertura das evidências: disponibilidade de cada observação obrigatória e conclusão do cenário.

Status por asserção: **pass**, **fail**, **unknown** e **not-applicable**. Os identificadores públicos permanecem em inglês. Unknown abrange observação ausente e captura interrompida. Not-applicable exige uma decisão explícita de capacidade/perfil. Uma capacidade obrigatória não suportada impede a aprovação geral.

Política geral de CI: código de saída 0 somente quando todas as asserções obrigatórias passam; 1 para violações observadas; 2 para configuração inválida, falha de infraestrutura ou evidência obrigatória incompleta. Se violações e falhas de infraestrutura coexistirem, relatar ambas e dar precedência ao código 2. Casos opcionais não suportados podem ser ignorados de forma visível; nunca aumentam o numerador da cobertura.

### Mensagens de falha e relatórios

Exemplos de mensagens propostas, ainda não implementadas. Permanecem em inglês porque representam a saída pública da ferramenta:

- **AIK-APPROVAL-001:** Write attempt `effect-2` occurred before a matching approval for `call-7`. Decision evidence: record 18. Effect evidence: record 14. Contract: `save-note/approval-required`.
- **AIK-STATE-001:** Client edit at `/checklist/0/done` was `true`; the next observed request contained `false`. Request record 22, edit record 19. Policy: preserve declared client-owned fields.
- **AIK-EVIDENCE-001:** Rejection recorded, but no effect observer covered the full scenario. Cannot determine whether a write occurred.

Relatar cada diagnóstico com camada, severidade, ID do contrato/regra, perfil, índice do evento/registro, JSON Pointer quando relevante, valores esperados/observados, posições relacionadas, completude da evidência e referência da fonte. Usar link para especificação somente em regras reais do protocolo; políticas da aplicação apontam para a localização do contrato. Mostrar a menor janela relevante de evidências, sem prometer minimização automática de contraexemplos.

### Fixtures e exemplos

Começar com 12 casos revisados manualmente: quatro interações válidas, quatro violações comportamentais correspondentes, dois casos de evidência incompleta e duas intercalações/divisões em fragmentos alternativas válidas. Adicionar gravações inválidas de protocolo referenciando ou reutilizando o corpus do projeto de origem, com atribuição de licença, em vez de reconstruí-lo.

Cada fixture registra origem, versões revisadas, capacidades necessárias, resultados esperados e status de sanitização. Fixtures públicas sintéticas não contêm mensagens reais, tokens, notas pessoais ou credenciais de banco. Preservar a ordem original; não “corrigir” o stream antes da validação.

Exemplos obrigatórios: fluxo em inglês de aprovação/rejeição de gravação de nota com fronteira simulada de escrita; ida e volta do estado de checklist editável; falha de gravação aprovada; integração mínima com cliente AG-UI sem framework. Agamenon é um quinto exemplo opcional depois que os exemplos independentes funcionarem. Não copiar a configuração de banco dele para o processo inicial de uso do kit.

### CI e critérios objetivos de sucesso

Usar testes convencionais com dependências fixadas, respostas predeterminadas do modelo e ferramentas simuladas. Publicar JSON/JUnit como artefatos do CI existente. Não é necessário bot de comentários no repositório ou GitHub Action própria. Manter separada uma suíte básica opcional com modelo real; definir uma seed em um LLM hospedado não garante determinismo.

Metas da versão alfa, a medir antes de divulgá-las como resultados:

- Todas as 12 fixtures produzem os resultados revisados e IDs de diagnóstico estáveis.
- Repeti-las 100 vezes produz relatórios normalizados idênticos, excluindo metadados de execução explicitamente variáveis.
- Nenhuma falsa falha nas intercalações alternativas válidas.
- Ausência de evidência obrigatória nunca produz resultado aprovado.
- O mesmo contrato executa no cliente independente e em uma integração de framework sem mudar a semântica das asserções.
- Pelo menos um teste demonstra um caso válido no protocolo, mas inválido na interação, aceito pelo validador existente isoladamente.
- Um desenvolvedor externo chega a uma falha significativa em até 15 minutos, sem chave de API ou banco de dados.
- Dois projetos externos mantêm pelo menos um cenário em CI; caso contrário, reavaliar a necessidade do pacote.

## Etapa 6 — Arquitetura

### Direção das dependências

Adaptadores de transporte/gravação produzem evidências. Um parser preserva posições na fonte. Um provedor de conformidade verifica eventos AG-UI. Um modelo de sessão correlaciona evidências entre requisições. Um avaliador puro de contratos consome esse modelo e as evidências. Geradores de relatórios serializam o resultado. Um executor de cenários coordena drivers e um relógio fora do caminho de avaliação pura.

Manter inicialmente esses componentes como módulos de um único pacote. Pacotes npm separados e monorepo não se justificam até que consumidores independentes ou restrições de dependências os exijam.

| Componente | Responsabilidade da interface | Acoplamento proibido |
| --- | --- | --- |
| Entrada/parser | Bytes/objetos → registros ou diagnósticos de interpretação | Sem reparos, inferências de interface ou decisões de política |
| Provedor de protocolo | Eventos + contexto inicial + perfil → diagnósticos/cobertura de protocolo | Sem política de aprovação da aplicação |
| Correlacionador de sessão | Requisições/eventos/decisões → identidades com escopo e relações causais | Não pressupor IDs de ferramentas globalmente únicos |
| Avaliador de contratos | Contrato validado + fatos → resultados das asserções | Sem rede, leituras de relógio, imports de frameworks ou execução de efeitos |
| Driver | Iniciar, fornecer decisão/estado de entrada, observar, concluir trabalho pendente e liberar recursos; declarar capacidades | Sem observações de “sucesso” repassadas incondicionalmente |
| Observador de efeitos | Evidências de tentativa/confirmação/falha vinculadas à proposta e aos argumentos | Sem inferência a partir do texto do assistente |
| Executor | Relógio, cancelamento do trabalho de teste, agendamento limitado e coleta | Sem um segundo mecanismo de validação |
| Gerador de relatórios | Relatório → string/artefato | Sem normalização que altere resultados |

### Semânticas críticas

**Limites da sessão.** Separar identidades de conversa, execução, invocação, versão de proposta e conexão. Uma requisição posterior pode carregar o resultado de uma invocação anterior de ferramenta do frontend. Inicializar a sessão com histórico relevante; uma chamada anterior não observada é evidência incompleta, a menos que o perfil permita demonstrar sua invalidade.

**Ordem parcial.** Preservar a ordem dentro de cada fonte. Relacionar fontes diferentes por correlação e relações causais, não por timestamps de relógios não confiáveis. Chamadas intercaladas podem ser válidas. Não exigir uma sequência global exata nem correspondência com texto incidental do assistente.

**Estado.** Aplicar patches sobre estado inicial explícito e preservar a proveniência. O estado reconstruído pelo avaliador é um modelo esperado; observar separadamente o estado real do cliente para testar sua atualização. Eventos de estado AG-UI e os [conceitos de estado bidirecional](https://docs.ag-ui.com/concepts/state) não estabelecem uma política universal de resolução de conflitos. Declarar responsabilidade sobre os campos e política de mesclagem em cada contrato. Não há garantia implícita de CRDT, repetição automática ou prevalência da última escrita.

**Encerramento.** Distinguir conclusão normal, transferência de execução para ferramenta, interrupção injetada, EOF do transporte e timeout de infraestrutura. Fechar um socket local não prova que o agente remoto parou. Um timeout é uma observação do teste sob um limite declarado, não uma violação automática de protocolo.

**Aprovação/retomada.** Mapear explicitamente as observações do driver. A [documentação oficial de eventos](https://docs.ag-ui.com/concepts/events) distingue eventos em rascunho de categorias estabelecidas; a [discussão sobre interrupções](https://github.com/ag-ui-protocol/ag-ui/discussions/827) documenta questões de projeto. Não inventar uma sequência estável e obrigatória de interrupção. Suporte a rascunhos é opcional e fixado a uma revisão da fonte.

### Versionamento

Versionar separadamente o schema de contratos, o schema de evidências, o schema de relatórios e o perfil do protocolo. Um perfil registra versões dos pacotes SDK, versão do validador, fonte/revisão/data da especificação, extensões habilitadas e ambiguidades conhecidas. O relatório deve expor todos esses dados.

Antes de implementar, resolver a taxonomia exata de eventos AG-UI suportados comparando um SDK de versão fixada com a documentação correspondente. Não fixar “16 eventos” com base em resumos antigos. Eventos desconhecidos continuam preservados; cobertura de perfil/extensão não suportada deve ser explícita. Divergências entre SDK e especificação precisam ser registradas como divergências, sem se tornarem silenciosamente regras do protocolo.

Mudar o que passa nos testes é uma mudança de compatibilidade, mesmo sem alteração das assinaturas TypeScript. Revisar mudanças de regras, executar o corpus, publicar notas de migração e nunca atualizar silenciosamente um perfil fixado.

### Justificativa das tecnologias

TypeScript é recomendado porque os primeiros consumidores executam clientes de frontend JavaScript e a validação AG-UI existente pode ser reutilizada nesse ambiente. Não exige React ou CopilotKit. Usar artefatos JSON padronizados e um dialeto explícito de schema para permitir equivalência futura com Python. Selecionar a versão mínima suportada de Node somente depois de verificar as dependências escolhidas e os projetos-piloto.

Usar o Vitest existente para testes determinísticos unitários/de integração onde se adequar ao piloto; Playwright convencional para a observação de navegador que não puder ser estabelecida sem ele. Nenhum é obrigatório para todos os consumidores. Hono, Mastra, React, Supabase, pgvector, Biome e Turborepo não são herdados automaticamente do Agamenon. Escolher ferramentas de formatação/build pelas necessidades de manutenção durante a implementação, não pelo posicionamento do produto.

Para Python posteriormente, implementar a mesma semântica do avaliador contra o corpus compartilhado e comparar relatórios canônicos. Não disponibilizar um segundo runtime antes de haver demanda externa e artefatos estáveis.

## Etapa 7 — Diferenciação com uma afirmação que pode ser refutada

| Categoria | Distinção proposta | Quando a distinção deixa de se sustentar |
| --- | --- | --- |
| Observabilidade | Executar teste limitado com política declarada de aprovação/falha e requisitos de evidência | Se o principal valor passar a ser coletar e exibir traces de produção |
| Replay | Conduzir transições do usuário/cliente e avaliar sua relação com efeitos | Se o produto apenas reprocessar logs salvos de ferramentas; AgentReplay já cobre boa parte disso |
| Benchmark genérico | Validar comportamento de integração com entradas predeterminadas | Se pontuar respostas de modelos ou classificar inteligência de agentes |
| Wrapper AG-UI | Fornecer semântica reutilizável de interação e contratos de evidência, reutilizando a validação de protocolo | Se a API pública apenas renomear funções de validação do projeto de origem |
| Testes específicos do Agamenon | Os mesmos contratos executam com um cliente independente e outra integração | Se todo predicado útil importar CopilotKit ou depender de notas/memória pessoais |

Hoje não há uma vantagem defensável forte. O ativo pode se tornar um corpus confiável e versionado de falhas reais do frontend, com adaptadores de baixo esforço mantidos junto ao ecossistema. Isso exige adoção e revisão, não apenas marca.

**Reformulação se o diferencial for fraco:** publicar “AG-UI Interaction Test Recipes” como fixtures, exemplos e contribuições aos projetos de origem. Um recurso pequeno e útil é melhor que um framework redundante.

## Etapa 8 — Validar antes de implementar

### Descoberta com prazo limitado

1. Selecionar três issues históricas com consequências de interação claramente reproduzíveis: perda de estado, chamadas paralelas do frontend e compactação de estado. Estabelecer versões afetadas/corrigidas antes de escrever fixtures.
2. Desenhar quatro contratos de interação no papel e mapear cada observação obrigatória para uma API ou ponto de instrumentação de teste existente.
3. Comparar o desenho com ag-ui-validate, AgentReplay e asserções de testes convencionais. Registrar exatamente qual lógica compartilhada está faltando.
4. Com autorização explícita para comunicação, perguntar aos mantenedores de AG-UI e do validador se o corpus deveria integrar os projetos deles. Nenhum contato foi enviado nesta tarefa.
5. Recrutar cinco engenheiros de frontend/integrações de pelo menos três times para entrevistas. Não equiparar stars ou incentivo verbal a demanda recorrente.

### Projetos a testar em seguida

| Alvo | Objetivo | Limite |
| --- | --- | --- |
| Endpoint/cliente AG-UI independente, com comportamento predeterminado | Referência inicial e controle de falsos positivos | Sem dependência de framework |
| Agamenon | Piloto acessível com Mastra/CopilotKit | Gravações simuladas isoladas; sem dados de produção |
| Integração oficial LangGraph | Comportamento de runtime independente, argumentos de ferramentas retornados de uma só vez | Fixar versões e saídas predeterminadas do modelo |
| Integração oficial Strands | Caso histórico de chamadas paralelas | Tratar issue fechada como evidência de regressão |
| Integração oficial A2A | Preservação do estado de entrada | Posteriormente, se for necessária uma fronteira entre múltiplos agentes |
| Corpus do ag-ui-validate | Cobertura básica de protocolo | Respeitar a licença da fonte; evitar duplicar regras |

Dois runtimes por trás do mesmo cliente CopilotKit não comprovam portabilidade entre clientes. Incluir um cliente independente antes de fazer essa afirmação. Um futuro segundo cliente de navegador deve exercitar a mesma semântica por um adaptador distinto de observação.

### Perguntas de entrevista, feitas uma por vez

1. Qual foi o último bug entre agente e interface que passou nos seus testes, e qual comportamento visível ao usuário quebrou?
2. Você consegue mostrar a sequência de requisições/eventos que falhou e o teste que adicionou?
3. Qual fronteira foi mais difícil de observar: estado do cliente, aprovação, resultado da ferramenta ou efeito efetivo?
4. Vitest/Playwright existentes com ag-ui-validate teriam resolvido? O que ainda exigiu código próprio?
5. Você atualiza runtimes ou clientes com frequência suficiente para precisar de cenários reutilizáveis de compatibilidade?
6. Quanto trabalho de adaptador/configuração faria você rejeitar outra dependência de desenvolvimento?
7. Você adicionaria um cenário a um CI real e o manteria por um mês?

### Menor protótipo valioso — fase posterior, não construído agora

Um teste convencional, um contrato, uma proposta predeterminada de gravação de nota, uma ação de rejeição e um observador simulado de gravações. Mostrar duas execuções cujos streams AG-UI passam na validação de protocolo: a interação incorreta tenta gravar apesar da rejeição; a corrigida não. Repetir com o cliente independente e a integração-piloto. Incluir um caso de observador ausente que retorna unknown.

Um segundo protótipo trata de uma edição de estado do usuário perdida na requisição seguinte. Esses exemplos comprovam a fronteira proposta de forma mais direta que um dashboard ou dezenas de regras de ciclo de vida.

### Continuar, mudar de direção ou encerrar

- **Continuar:** pelo menos três entrevistados apresentam incidentes concretos recentes; dois times integram um cenário reutilizável; um confirma independentemente a utilidade do diagnóstico; o mesmo contrato funciona em dois drivers.
- **Contribuir nos projetos de origem:** o valor ausente está em fixtures/documentação ou em poucas regras do validador existente.
- **Mudar para receitas de testes no navegador:** observações sem navegador não capturam a falha real e os usuários preferem fixtures convencionais de Playwright.
- **Encerrar o novo pacote:** menos de dois times mantêm um caso em CI após o piloto, cada adaptador exige uma linguagem própria de contratos ou as ferramentas existentes cobrem os exemplos com esforço de configuração igualmente pequeno.
- **Reduzir o escopo:** falsos positivos dependem de suposições não documentadas do protocolo; manter apenas contratos explícitos da aplicação enquanto se pede esclarecimento aos mantenedores.

### Sequência de entrega após decisão de continuar

| Marco | Entrega | Critério de conclusão |
| --- | --- | --- |
| M0 — Descoberta | Mapa de evidências revisado, comparações e entrevistas | Dor externa e comportamento reutilizável ausente estabelecidos |
| M1 — Semântica | Schemas de contratos/evidências e 12 fixtures revisadas | Regras, resultados desconhecidos e escopo de identidade sem ambiguidades |
| M2 — Núcleo | Avaliador puro e fronteira do provedor de conformidade | Corpus determinístico e tratamento de entradas malformadas aprovados |
| M3 — Comprovação da interação | Driver independente e integração-piloto | Mesmo contrato detecta uma falha de interação válida no protocolo |
| M4 — Alfa | CLI mínima de artefatos, relatórios de CI e exemplos em inglês | Critérios de adoção inicial e CI externos atendidos |

Não iniciar M2 enquanto M0 ainda indicar que o projeto é redundante. M1 é uma entrega de desenho, não autorização para expandir o produto.

## Decisões antes da especificação final de implementação

| Decisão | Padrão recomendado | Status |
| --- | --- | --- |
| Usuário principal | Engenheiros de frontend/plataforma que entregam interações AG-UI | Hipótese; resposta de priorização do usuário pendente |
| Projeto separado ou contribuição nos existentes | Corpus primeiro; pacote independente apenas após comprovar reutilização | Em aberto |
| Nome público e escopo do pacote | Agent Interaction Kit | Nome de trabalho; disponibilidade desconhecida |
| Primeiro contrato | Rejeitar uma proposta de gravação de nota produz zero tentativas de escrita | Proposto |
| Segundo contrato | Edição de estado do cliente é preservada na requisição seguinte sob responsabilidade explícita pelos campos | Proposto |
| Fronteira das evidências | Observações reais do driver/cliente e observador independente de efeitos simulados | Precisa ser validada nos pilotos |
| Perfil inicial de compatibilidade | Um par estável SDK/validador AG-UI de versões fixadas; rascunhos desabilitados | Versões exatas não resolvidas |
| Dependência de conformidade | Avaliar ag-ui-validate antes de construir algo equivalente | Revisão de código/testes ainda necessária |
| Segunda implementação | Cliente independente + piloto Mastra; runtime independente em seguida | Proposto |
| Formatos de distribuição | Pacote TS e CLI mínima de artefatos; sem executor próprio de testes | Proposto |
| Licença | MIT para um kit pequeno e reutilizável de desenvolvimento, sujeita a revisão de dependências/licenças | Recomendação; nenhum arquivo LICENSE criado |
| Capacidade de manutenção | Um responsável pela triagem de regras e atualização de versões; recrutar revisores | Não confirmada |
| Critério para continuar ou encerrar | Dois adotantes externos em CI e comprovação reutilizável de falha válida no protocolo | Proposto |

**Decisão executiva:** investir em um pequeno esforço de validação, não em uma plataforma genérica de conformidade. A oportunidade plausível é testar de forma reutilizável a fronteira de interação entre agente e frontend; seu valor como produto independente continua sem comprovação.
