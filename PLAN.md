# Agent Interaction Kit

> Tool and interaction contract testing for AG-UI applications.

## Plano vigente — revisão 2

Data: 06/09/2026. Planejamento em pt-BR; código, APIs, mensagens, exemplos e documentação pública em inglês. Nome provisório, com disponibilidade pública ainda não verificada.

Este plano incorpora a prioridade aceita pelo autor: **detectar divergências entre ferramentas e expectativas do backend/frontend antes que apareçam nas respostas do chat**. Os dois primeiros runtimes candidatos são **Microsoft Agent Framework em .NET** e **Mastra em TypeScript**. CopilotKit é o primeiro cliente de integração, sem ser uma dependência obrigatória do núcleo.

A [pesquisa inicial](RESEARCH.md) preserva fontes, métricas e alternativas consideradas. As prioridades e os marcos deste documento substituem os daquela pesquisa. Ainda não há implementação. Este é um plano de execução; não uma promessa de compatibilidade já testada.

## 1. Problema e resultado esperado

**Relato do autor:** um produto em produção usa .NET/MAF no backend e AG-UI/CopilotKit no frontend. Os times recebem atualizações em momentos diferentes. Alterações em ferramentas e expectativas deixam a comunicação SSE funcionando, mas provocam resultados incoerentes, percebidos durante o uso do chat. Nenhum código, log ou incidente desse produto foi inspecionado nesta tarefa.

**Hipótese:** parte dessas falhas pode ser antecipada verificando contratos direcionais das ferramentas e exercitando o código consumidor real com respostas controladas. Nem toda variação de resposta é incompatibilidade: decisões do modelo, prompts, estado, flags e permissões também podem variar.

**Resultado desejado:** ao alterar uma ferramenta, o desenvolvedor recebe um diagnóstico que identifica qual consumidor, versão, campo ou comportamento deixou de ser atendido. Não precisa descobrir a falha manualmente conversando com o agente.

Exemplo sintético: `searchDocuments` retornava uma lista e passa a retornar um objeto com `items` e `total`. O frontend ainda espera a lista. Os eventos AG-UI podem continuar válidos, mas o contrato de resultado e o teste do consumidor devem falhar. O exemplo público não depende de dados ou regras de negócio do produto profissional do autor.

| Item | Situação |
| --- | --- |
| Priorizar compatibilidade de ferramentas | Aceito pelo autor |
| MAF/.NET e Mastra como primeiros candidatos | Aceito pelo autor |
| Camada utilizável no frontend | Interesse explícito; API e ponto de integração a validar |
| Problema recorrente em produção | Relatado pelo autor; causa técnica não reproduzida |
| Biblioteca independente necessária | Hipótese; comparar com ferramentas existentes |
| Acesso ao produto profissional | Não fornecido nem necessário para os exemplos públicos |
| Agamenon como laboratório Mastra | Disponível localmente; não substitui prova em MAF |

## 2. Formato do produto

**Biblioteca TypeScript + CLI pequena + formato JSON de contratos + exemplos verificáveis em MAF/.NET e Mastra.**

| Entrega | Responsabilidade | Uso |
| --- | --- | --- |
| Contratos e manifestos | Capacidades oferecidas e expectativas consumidas, com origem e versão | Artefatos versionados pelos times |
| Núcleo TypeScript | Validar documentos, avaliar compatibilidade suportada e verificar payloads concretos | Testes, frontend e CLI |
| Camada opcional de frontend | Validar argumentos concluídos antes do handler e resultados antes do código consumidor | Desenvolvimento, testes e uso opcional em produção |
| CLI | Comparar artefatos e verificar evidências gravadas | Local e CI, inclusive de repositório .NET |
| Exemplos de integração | Exportar registros e executar cenários reais com dependências simuladas | MAF/.NET e Mastra |
| Provedor de conformidade AG-UI | Reutilizar validação de protocolo existente | Diagnósticos separados dos contratos |

A CLI pode rodar como etapa Node do pipeline .NET, consumindo JSON e acessando um endpoint de teste. Começar a integração C# com um helper no exemplo que exporta o registro usado pelo agente. Criar pacote NuGet separado apenas se esse helper se mostrar reutilizável e necessário.

Não criar executor de testes próprio. Vitest e testes .NET existentes continuam responsáveis por setup, execução e encerramento dos processos. Um pacote npm com módulos e exports separados é suficiente inicialmente; os exemplos podem ter projetos próprios. Não criar uma estrutura complexa de monorepo por antecipação.

## 3. Quatro perguntas diferentes

| Camada | Pergunta | Evidência necessária |
| --- | --- | --- |
| Declaração | As capacidades publicadas atendem às expectativas declaradas? | Manifestos e contratos vinculados a builds |
| Registro efetivo | A ferramenta/handler está registrada neste cenário? | Exportação ou instrumentação do registro usado pelo código |
| Payload observado | Os argumentos/resultados concretos satisfazem o contrato? | Dados na fronteira real de execução/consumo |
| Interação | A chamada termina, o resultado é correlacionado e o fluxo retoma? | Cenário executado com observações do cliente e backend |

Comparar dois JSONs escritos manualmente não prova compatibilidade da aplicação. O relatório deve dizer quais camadas foram verificadas. “Declarado”, “registrado”, “observado” e “verificado por cenário” não são sinônimos.

Uma ferramenta ausente em um stream pode estar disponível, mas não ter sido escolhida. Um manifesto global não comprova disponibilidade em toda sessão: papéis, permissões, flags e contexto podem mudar o registro. O kit exige perfis de contexto explícitos; não promete descoberta universal.

## 4. Contratos direcionais de ferramentas

Cada lado declara **o que oferece** e **o que exige dos demais**. Frontend não é sempre consumidor e backend não é sempre provedor.

| Fluxo | Quem produz | Quem aceita/consome |
| --- | --- | --- |
| Argumentos de ferramenta backend | Agente/backend, orientado pelo schema da ferramenta | Implementação backend; frontend pode observar/renderizar |
| Resultado da ferramenta backend | Implementação backend e serialização AG-UI | Código consumidor/renderizador do frontend e agente |
| Argumentos de ferramenta frontend | Agente/backend | Handler do frontend |
| Resultado da ferramenta frontend | Handler do frontend | Backend na continuação |

Ferramenta backend com renderização no frontend não é ferramenta executada no frontend. Não exigir handler visual para toda ferramenta interna: o consumidor declara se precisa de renderização específica, aceita apresentação genérica ou ignora aquele evento.

`RunAgentInput.tools` descreve ferramentas fornecidas pelo cliente, não um inventário universal do backend. O schema de resultado do kit é metadado de teste da aplicação, não um novo campo obrigatório do AG-UI. [Ferramentas no AG-UI](https://docs.ag-ui.com/concepts/tools)

### Artefatos propostos

| Artefato | Conteúdo mínimo |
| --- | --- |
| Manifesto do provedor | `schemaVersion`, `producer`, `buildId`, `contractVersion`, `protocolProfile`, `contextProfile`, `tools` |
| Expectativas do consumidor | `schemaVersion`, `consumer`, `buildId`, `requires`, política de fallback e referências de cenários |
| Descritor de ferramenta | `name`, `executionSide`, schemas de argumentos/resultados, codificação do resultado, política de erro, exigências de aprovação e origem |
| Cenário | Identidade, precondições, estímulo predeterminado, observações exigidas, asserções e término |
| Relatório | Identidades/hashes dos artefatos, versões, contexto, resultados por camada, evidências e cobertura |

Os identificadores são propostas em inglês, não APIs publicadas. M0 define o dialeto JSON Schema e o subconjunto suportado. Não buscar referências externas de schema automaticamente nem transportar código executável nos manifestos.

No frontend, preferir uma definição que alimente tanto o registro real quanto o manifesto, ou um teste que compare ambos. No MAF e Mastra, exportar schemas das definições efetivamente utilizadas quando a API permitir. Regras não expostas pelo framework, como semântica do resultado, precisam ser declaradas e verificadas por testes.

### Regras iniciais de compatibilidade

Para cada fluxo, os valores que o produtor declara poder emitir precisam caber nos valores que o consumidor aceita. A regra também vale quando frontend e backend trocam de papel. Não comparar apenas igualdade de arquivos ou versões semânticas.

| Alteração | Diagnóstico esperado |
| --- | --- |
| Remover/renomear ferramenta exigida | Incompatível sem substituição ou fallback declarado e testado |
| Exigir argumento novo | Incompatível com produtor que ainda pode omiti-lo |
| Reduzir enum aceito na entrada | Incompatível se o produtor puder enviar valor removido |
| Ampliar enum de resultado | Pode quebrar consumidor que trata apenas valores antigos |
| Deixar de garantir campo de resultado exigido | Incompatível com esse consumidor |
| Adicionar campo de resultado | Depende da aceitação de propriedades adicionais |
| Trocar lista por objeto | Incompatível no fluxo afetado |
| Alterar local de execução da ferramenta | Exige migração explícita de contrato e cenário |
| Alterar erro, aprovação ou continuação | Verificar política/cenário; schemas iguais são insuficientes |
| Alterar descrição da ferramenta | Registrar mudança; efeito na escolha do modelo não é inferível estaticamente |

**Não implementar um provador genérico de compatibilidade de JSON Schema.** Usar subconjunto explícito e regras revisadas. Construções não analisáveis retornam `unknown`, sem resultado verde. Igualdade canônica de schemas suportados pode comprovar compatibilidade declarada naquele escopo, mas não equivalência comportamental. Validar exemplos concretos prova somente esses exemplos.

## 5. Camada de validação no frontend

O ponto de integração é a fronteira entre dados AG-UI reconstruídos e o código da aplicação que executa ou renderiza a ferramenta.

1. Registrar/exportar ferramentas e expectativas do consumidor.
2. Reconstruir os argumentos pelo fluxo normal do cliente. JSON parcial de `TOOL_CALL_ARGS` não é argumento completo inválido.
3. Validar argumentos concluídos antes de invocar o handler real.
4. Decodificar e validar resultados antes de entregá-los ao consumidor real.
5. Associar diagnósticos à ferramenta, chamada, conversa, builds e regra.

Não exigir resultado objeto JSON para toda ferramenta: o contrato especifica texto, JSON serializado ou outro formato explicitamente suportado. Não inferir schema de resultado a partir da prosa do chat.

Em desenvolvimento/testes, falhas reprovam a asserção. No uso opcional em produção, o host escolhe uma política explícita: relatar, recusar execução de uma ferramenta específica ou mostrar fallback. O kit fornece diagnóstico/callback, não desenha UI nem lança erros globais indiscriminadamente. Não corrigir payload silenciosamente. Testar o encerramento da chamada rejeitada para não deixar a interface carregando indefinidamente.

O módulo de navegador não importa Node, MAF, Mastra, CLI ou runtime do CopilotKit. A adaptação CopilotKit fica separada e usa APIs públicas verificadas nas versões adotadas.

Esta camada detecta violações observadas. Não substitui autorização no backend, comprovação de efeitos ou matriz de compatibilidade antes do deploy.

## 6. Escopo por versão

### Primeiro incremento demonstrável — M0 a M2

- Contrato de uma ferramenta sintética: `searchDocuments`.
- Manifestos/expectativas associados a registros reais.
- CLI offline com regras conservadoras e evidência insuficiente explícita.
- Verificação de payload na função real que consome o resultado no frontend.
- Caso correto e alteração lista → objeto que mantém SSE válido e quebra o consumidor.
- Sem modelo pago, banco ou serviço permanente.

### Alfa — inclui MAF e Mastra

- Mesmos contratos e corpus relevante executados nos dois exemplos.
- Uma ferramenta backend renderizada no frontend e uma ferramenta frontend com retorno ao backend.
- Ferramenta ausente, argumento obrigatório novo, resultado incompatível, handler ausente e erro com formato inesperado.
- Conformidade AG-UI reutilizada de provedor existente, como ag-ui-validate, após verificar adequação ao perfil escolhido.
- Relatórios de terminal, JSON e JUnit; testes existentes e CLI mínima.
- Camada frontend para desenvolvimento/testes; uso em produção experimental e opcional.

### Após a alfa

Aprovação/retomada completas, efeitos duplicados, estado bidirecional, reconexão, cancelamento remoto, cliente adicional e novas integrações. Aprovação simples pode ser explorada antes, mas não condiciona a primeira entrega de divergência de tools.

### Fora do produto inicial

Dashboard, autenticação, billing, banco, broker próprio de contratos, tracing de produção, replay genérico, benchmark de respostas, julgador LLM, runtime de agentes, registry universal de tools, geração automática de todos os contratos e suporte irrestrito a qualquer schema/versão.

## 7. Integrações MAF/.NET e Mastra

### MAF/.NET

Usar exemplo público pequeno com endpoint real `MapAGUIServer`, definições reais de ferramentas e comportamento do modelo controlado. Confirmar na versão fixada a interface pública adequada para substituir o cliente de modelo. [Integração .NET AG-UI](https://learn.microsoft.com/en-us/agent-framework/integrations/ag-ui/getting-started)

O helper C# exporta o registro em JSON. O CI inicia o endpoint, aguarda prontidão, executa verificações TypeScript e encerra o processo mesmo em falha. Observar o resultado que retorna ao backend em ferramentas frontend: o fluxo documentado envolve declaração, chamada, execução local e continuação. [Ferramentas de frontend no MAF](https://learn.microsoft.com/en-us/agent-framework/integrations/by-component/ui/ag-ui/frontend-tools)

Não inferir suporte .NET com base em exemplos Python. Fixar versões de MAF, hosting e SDK AG-UI .NET. Compatibilidade com a instalação profissional só pode ser afirmada após conhecer e testar suas versões.

### Mastra

Extrair exemplo mínimo do padrão já observado no Agamenon: definições de ferramentas Mastra, adapter AG-UI e cliente CopilotKit. Exportar schema/registro efetivos e avaliar serialização real dos resultados. Usar dependências simuladas e respostas predeterminadas por interface pública suportada.

Os manifests locais declaram intervalos `@mastra/core ^1.64.0`, `@ag-ui/mastra ^1.1.2` e `@copilotkit/react-core ^1.70.1`. Não são versões resolvidas comprovadas. Consultar o lockfile antes de selecionar a matriz. Nenhuma atualização no Agamenon foi feita.

### Comprovação independente

MAF e Mastra devem produzir o mesmo resultado contratual, não bytes ou sequência global idênticos. Preservar fragmentações/intercalações legais. Executar o núcleo também com um consumidor mínimo independente de CopilotKit, sem prometer suporte completo a todos os clientes.

Servidor SSE inteiramente falso testa o parser, mas não comprova integração MAF/Mastra. A alfa precisa executar os adapters reais, controlando o modelo e as dependências externas.

## 8. Arquitetura e interfaces propostas

| Módulo | Interface conceitual | Restrição |
| --- | --- | --- |
| `contracts` | Documento desconhecido → contrato validado ou erro de configuração | Sem I/O, código embutido ou busca remota |
| `compatibility` | Ofertas + requisitos + perfil → compatibilidade declarada | Subconjunto explícito; preservar `unknown` |
| `payloads` | Valor concluído + schema/codificação → validação | Puro e utilizável no navegador |
| `agui` | Eventos/contexto → evidências e diagnósticos de protocolo | Reutilizar validador; preservar ordem e origem |
| `frontend` | Registros/observações reais → verificações | Núcleo independente de framework |
| `adapters/copilotkit` | Pontos públicos do cliente → interface de observação | Detalhes fora do núcleo |
| `reporters` | Relatório → terminal/JSON/JUnit | Não recalcular resultados |
| `cli` | Arquivos/opções → núcleo e código de saída | Sem duplicar lógica de compatibilidade |
| Exemplos MAF/Mastra | Registro real + execução controlada → manifestos/evidências | Não são dependências da biblioteca |

Operações candidatas: `validateContract`, `compareContracts`, `validateToolArguments`, `validateToolResult`, `verifyInteraction`, `formatReport`. M0 define entradas, erros e formato estável; ainda não são APIs lançadas.

JSON permite interoperabilidade; TypeScript atende ao consumidor frontend e ao núcleo no navegador; C# fica na integração MAF. Não adicionar implementação Python antes de demanda.

## 9. CI para entregas independentes

Cada build produz artefatos imutáveis com identidade/versão, hash do contrato, contexto e versões de runtime/SDK/cliente. A referência de produção vem do registro real de deploy ou de seleção explícita; a branch principal não é necessariamente produção.

| Combinação obrigatória | Objetivo |
| --- | --- |
| Backend candidato × frontend em produção | Atualizar backend sem quebrar consumidor atual |
| Frontend candidato × backend em produção | Atualizar frontend antes da entrega backend |
| Backend candidato × frontend candidato | Verificar próxima combinação planejada |

Repetir para cada família MAF/Mastra suportada, sem cruzamentos artificiais entre aplicações independentes. Se clientes antigos permanecerem em abas abertas ou durante rollback, incluir essas versões na política de suporte.

Usar arquivos e artefatos do CI inicialmente. Contratos em produção são requisitos atuais; contratos novos ainda não implantados são candidatos e não devem bloquear indiscriminadamente releases independentes por funcionalidades futuras.

Comparação estática e execução são jobs distintos: a primeira avalia declarações; a segunda prova cenários para o par exato. Artefato, contexto ou teste ausente não permite selo geral de compatibilidade.

Status: `pass`, `fail`, `unknown`, `not-applicable`. Código 0 somente com requisitos do job atendidos; 1 para violação comprovada; 2 para configuração, infraestrutura ou evidência obrigatória insuficiente. Quando coexistirem, 2 tem precedência, preservando todas as falhas no relatório.

## 10. Diagnósticos e corpus

Exemplos de mensagens públicas propostas:

- `AIK-TOOL-001: Required frontend tool "selectDocument" is not registered in context "default".`
- `AIK-RESULT-001: "searchDocuments" returned an object; consumer "web@1" requires an array at "/".`
- `AIK-INPUT-001: Producer may omit "documentType", but the receiving tool requires it.`
- `AIK-EVIDENCE-001: Backend build identity was not observed; verification cannot be attributed to the selected artifact.`

Informar camada, regra, direção, ferramenta, produtor/consumidor, builds, contexto, localização, esperado/observado e evidências. Regras da aplicação apontam ao contrato; regras de protocolo apontam à especificação. Evitar payload completo quando caminho e categoria do erro bastarem.

| Grupo de fixtures | Quantidade |
| --- | ---: |
| Válidos: ferramenta backend, ferramenta frontend, campo extra aceito, fragmentação alternativa | 4 |
| Incompatíveis: ferramenta removida, argumento obrigatório novo, lista → objeto, campo obrigatório ausente, handler ausente, erro incompatível | 6 |
| Evidência insuficiente: schema fora do subconjunto, identidade/registro não verificável | 2 |

São 12 casos lógicos, executados nos dois exemplos onde aplicáveis. Não aplicabilidade exige motivo. Os testes principais não usam LLM externo. Os testes do consumidor invocam seu código real, não apenas validam o próprio mock.

## 11. Backlog em ordem de execução

Estimativas para um mantenedor experiente, sem hospedagem. Revisar após descobrir APIs e versões.

| Marco | Trabalho | Critério de aceite | Esforço |
| --- | --- | --- | --- |
| M0 — Contrato mínimo e prova de integração | Escolher versões, desenhar uma tool, selecionar subconjunto de schema, verificar exportação/controle do modelo em ambos os runtimes e comparar com Pact/ag-ui-validate | Spec curta sem ambiguidades e pontos públicos de integração identificados | 2–4 dias |
| M1 — Comparação declarada | Parser, núcleo conservador, regras direcionais, CLI e JSON | Mudança incompatível falha; suportada passa; schema não analisável retorna unknown | 3–5 dias |
| M2 — Consumidor real | Validação de argumentos/resultados, exemplo independente e integração inicial CopilotKit | Resultado incompatível é detectado antes de quebrar o consumidor, com SSE válido; handler real exercitado | 3–5 dias |
| M3 — MAF/.NET | Endpoint real, exportação de registro, modelo controlado e tools nas duas direções | Casos executados contra adapter MAF real e builds identificados | 4–6 dias |
| M4 — Mastra | Mesmo conjunto de contratos em exemplo mínimo | Reutilização das asserções sem regras específicas de MAF ou dados do Agamenon | 3–5 dias |
| M5 — Alfa | Matriz CI, corpus, JUnit, documentação e exemplos em inglês | Instalação limpa reproduz falha nos dois runtimes sem conta ou chave de modelo | 3–5 dias |

M0 avalia ambos cedo para evitar contrato impossível de observar em um runtime. A implementação completa MAF vem primeiro por refletir a dor relatada; Mastra comprova reutilização antes da alfa. A soma é aproximadamente 4–6 semanas de trabalho, sujeita à revisão após M0.

### Primeira demonstração pública

Frontend v1 consome `searchDocuments`. Backend v2 continua emitindo SSE válido, mas muda o resultado. Mostrar comparação contratual falhando antes do deploy, teste do consumidor real detectando a incompatibilidade e versão corrigida passando. Repetir em MAF e Mastra. Não comparar prosa do chat nem apresentar como avaliação da inteligência do agente.

## 12. Reutilização e critérios de sucesso

[ag-ui-validate](https://github.com/langport-dev/ag-ui-validate) já trata conformidade de streams. Reutilizar quando adequado, sem recriar seu catálogo.

[Pact](https://docs.pact.io/) já aborda contratos entre consumidores/provedores e distingue schemas de contratos exercitados por exemplos. Seus [guias de testes de consumidor](https://docs.pact.io/consumer) reforçam testar o código real. Matriz de versões e contrato compartilhado não são diferenciais inéditos do kit.

**Diferencial proposto, a provar:** adaptação reutilizável de contratos ao fluxo AG-UI, com registro de ferramentas dos dois lados, argumentos fragmentados, codificação de resultados e continuação de ferramentas frontend, em uma camada pequena utilizável no navegador.

M0 deve comparar o cenário com Pact + validação AG-UI + testes comuns e identificar trabalho adicional. Não presumir incapacidade do Pact. Se faltar apenas um adaptador ou receitas, essa pode ser a entrega open source, sem novo motor geral de contratos.

Critérios da alfa:

- Detectar incompatibilidades do corpus sem reprovar casos válidos.
- Nunca apresentar evidência insuficiente como compatibilidade comprovada.
- Manter resultados normalizados em 100 repetições determinísticas.
- Reutilizar contrato e asserções em MAF e Mastra.
- Consumidor independente usa o núcleo sem importar CopilotKit.
- Desenvolvedor externo reproduz falha em até 15 minutos seguindo documentação em inglês.
- Dois times mantêm caso em CI no piloto; relato do autor não equivale a dois adotantes.

Se os frameworks exigirem APIs privadas extensas, reduzir a interfaces explícitas e exemplos. Se ferramentas existentes tiverem custo equivalente de integração, contribuir nelas. O objetivo é reduzir incompatibilidades, não manter um pacote a qualquer custo.

## 13. Decisões para abrir a implementação

Já definido: prioridade em tools, MAF/.NET + Mastra, núcleo TypeScript, CLI mínima, planejamento pt-BR e projeto público em inglês.

Decisões de M0:

1. Versões exatas de MAF/hosting/SDK AG-UI .NET e Mastra/AG-UI/CopilotKit.
2. Pontos públicos para exportar registros e observar entrada/saída do consumidor.
3. Dialeto/subconjunto de JSON Schema e codificação de resultados.
4. Primeiro perfil de contexto `default`; ampliar só quando necessário.
5. Ferramenta sintética representativa, sem depender de arquivos da aplicação profissional.
6. Relação com Pact: extensão/receitas ou núcleo próprio de escopo distinto comprovado.

MIT continua recomendação, não licença publicada. Nome/pacote exigem verificação de disponibilidade. A prova pode começar nos exemplos públicos antes do acesso ao produto profissional; compatibilidade com ele só será afirmada após testar suas versões e cenários.

**Próximo passo executável:** concluir M0 e escrever a spec curta de `searchDocuments`, com caso compatível, incompatível e evidência insuficiente. Depois iniciar o núcleo e a CLI de M1.
