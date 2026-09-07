# Agent Interaction Kit (AIK) — Design Specification

**Data:** 2026-09-07  
**Status:** Aprovado para Implementação  
**Escopo Inicial:** Marco M1 (Contratos CDC, Motor de Compatibilidade, CLI e Fixtures)  
**Repositório:** `agent-interaction-kit`

---

## 1. Contexto e Problema

Em aplicações de agentes de inteligência artificial com interface visual (AG-UI, CopilotKit), o backend (ex: Microsoft Agent Framework em .NET ou Mastra em TypeScript) e o frontend (React) evoluem e realizam deploys em momentos distintos.

Quando definições de ferramentas (tool calls) sofrem alterações — como a adição de parâmetros obrigatórios, mudanças de nomes ou alteração estrutural no retorno (ex: de uma lista `[]` para um objeto paginado `{ items, total }`):
- O stream SSE de eventos do protocolo AG-UI continua emitindo mensagens sintaticamente válidas.
- A aplicação não apresenta erro de rede ou de protocolo de baixo nível.
- O código do consumidor (componente visual ou handler de ação) falha silenciosamente ou produz comportamentos incoerentes percebidos apenas manualmente no chat pelo usuário final.

### Objetivo do Agent Interaction Kit
Fornecer uma ferramenta determinística e orientada a contratos para detectar quebras de compatibilidade entre as capacidades oferecidas pelo backend e as expectativas do frontend **antes do deploy (no CI)** e **em tempo de desenvolvimento**, sem depender de modelos LLM externos, bancos de dados ou serviços persistentes.

---

## 2. Decisões Arquiteturais Fundamentais

1. **Formato do Pacote:** Pacote único (`single-package`) com subpath exports modulares no `package.json` (`./contracts`, `./core`, `./payloads`, `./reporters`), mantendo o setup leve sem overhead de monorepos.
2. **Modelo de Contrato:** *Consumer-Driven Contracts* (CDC), separando o **Manifesto do Provedor** (`aik.provider.json`) das **Expectativas do Consumidor** (`aik.consumer.json`).
3. **Subconjunto de JSON Schema e Regras Direcionais:**
   - Suporte estrito a tipos primitivos (`string`, `number`, `boolean`), objetos (`properties`, `required`, `additionalProperties`), arrays (`items`) e enums.
   - Regras direcionais com base no lado de execução (`executionSide: "backend" | "frontend"`).
   - Ausência de falsos positivos: esquemas fora do subconjunto retornam status `unknown` (Exit code `2`).
4. **Interface CLI Unificada:** Comando `aik check --provider <file> --consumer <file>` com exit codes semânticos (`0 = pass`, `1 = fail`, `2 = unknown/error`) e múltiplos formatadores de saída (`terminal`, `json`, `junit`).
5. **Geração Assistida por IA (Agent Skill):** Inclusão de especificação de Skill de Agente (`skills/generate-contracts/SKILL.md`) para inspecionar código (.NET e React) e gerar manifestos automaticamente.
6. **Stack Técnica:** TypeScript 5+, Node 20+, `tsup` para build (ESM/CJS/d.ts), `Vitest` para testes, `Biome` para formatação/lint, `Ajv` para validação de JSON Schema e `Commander` para a CLI.

---

## 3. Estrutura de Diretórios e Módulos

```
agent-interaction-kit/
├── .github/
│   └── workflows/
│       └── ci.yml               # Pipeline de integração contínua
├── bin/
│   └── aik.ts                   # Entrypoint executável da CLI
├── src/
│   ├── contracts/               # Tipos, metaschemas e validação de documentos CDC
│   │   ├── types.ts             # Interfaces TypeScript
│   │   ├── schemas.ts           # JSON Schemas formais dos manifestos AIK
│   │   ├── parser.ts            # Parser e leitor com validação via Ajv
│   │   └── index.ts
│   ├── core/                    # Motor de compatibilidade direcional
│   │   ├── compatibility.ts     # Orquestrador de verificação
│   │   ├── rules/               # Regras isoladas de verificação
│   │   │   ├── tools-presence.ts    # AIK-TOOL-001 / AIK-TOOL-002
│   │   │   ├── arguments-rule.ts    # AIK-INPUT-001 / AIK-INPUT-002
│   │   │   └── results-rule.ts      # AIK-RESULT-001 / AIK-RESULT-002
│   │   ├── diagnostics.ts       # Catálogo e fábrica de diagnósticos
│   │   └── index.ts
│   ├── payloads/                # Validador de dados concretos em tempo de execução
│   │   ├── validator.ts
│   │   └── index.ts
│   ├── reporters/               # Formatadores de saída
│   │   ├── terminal.ts          # Saída com cores ANSI e tabelas
│   │   ├── json.ts              # JSON estruturado para automações e bots
│   │   ├── junit.ts             # XML JUnit para dashboards de CI
│   │   └── index.ts
│   ├── cli/                     # Implementação dos comandos da CLI
│   │   ├── commands/
│   │   │   └── check.ts
│   │   └── index.ts
│   └── index.ts                 # Export da biblioteca pública
├── fixtures/                    # Corpus sintético para testes determinísticos
│   ├── valid/                   # Cenário compatível
│   ├── breaking-result/         # Quebra de tipo de retorno (lista -> objeto)
│   ├── breaking-args/           # Quebra de argumento novo obrigatório
│   ├── missing-tool/            # Tool requerida inexistente
│   └── unknown-schema/          # Schema complexo fora do subconjunto
├── tests/                       # Testes automatizados com Vitest
│   ├── contracts/
│   ├── core/
│   ├── cli/
│   └── e2e/
├── skills/
│   └── generate-contracts/
│       └── SKILL.md             # Instruções para agentes IA gerarem manifestos
├── package.json
├── tsconfig.json
├── tsup.config.ts
├── biome.json
└── vitest.config.ts
```

---

## 4. Especificação dos Contratos (CDC)

### 4.1. Manifesto do Provedor (`aik.provider.json`)
```json
{
  "$schema": "https://aik.dev/schemas/v1/provider.json",
  "schemaVersion": "1.0.0",
  "producer": {
    "name": "string",
    "version": "string",
    "buildId": "string"
  },
  "protocolProfile": "string",
  "contextProfile": "string",
  "tools": [
    {
      "name": "string",
      "executionSide": "backend | frontend",
      "description": "string (opcional)",
      "parameters": { "type": "object" },
      "returns": {
        "format": "json | text | raw",
        "schema": { "type": "object | array | string | number | boolean" }
      },
      "requiresApproval": false
    }
  ]
}
```

### 4.2. Expectativas do Consumidor (`aik.consumer.json`)
```json
{
  "$schema": "https://aik.dev/schemas/v1/consumer.json",
  "schemaVersion": "1.0.0",
  "consumer": {
    "name": "string",
    "version": "string",
    "buildId": "string"
  },
  "protocolProfile": "string",
  "contextProfile": "string",
  "requires": [
    {
      "toolName": "string",
      "executionSide": "backend | frontend",
      "expectedParameters": { "type": "object" },
      "expectedReturns": {
        "format": "json | text | raw",
        "schema": { "type": "object | array | string | number | boolean" }
      },
      "fallbackPolicy": "fail-fast | silent-ignore"
    }
  ]
}
```

---

## 5. Regras Direcionais de Compatibilidade e Diagnósticos

As regras são avaliadas considerando quem produz e quem aceita cada payload:

| Código | Nome da Regra | Lógica Direcional | Condição de Falha |
| :--- | :--- | :--- | :--- |
| **`AIK-TOOL-001`** | `RequiredToolMissing` | Existência no Provedor | O consumidor exige a tool `T` no contexto `C`, mas o provedor não a declara. |
| **`AIK-TOOL-002`** | `ExecutionSideMismatch` | Lado de Execução | O consumidor declara `executionSide: "X"` e o provedor declara `"Y"`. |
| **`AIK-INPUT-001`** | `MandatoryArgumentMissing` | Contravariância de Argumentos | O receptor exige um argumento obrigatório que o emissor não garante fornecer. |
| **`AIK-INPUT-002`** | `ArgumentEnumMismatch` | Contravariância de Enum | O emissor pode enviar um valor de enum que foi removido ou não é aceito pelo receptor. |
| **`AIK-RESULT-001`** | `ResultRootTypeMismatch` | Covariância de Retorno | O tipo raiz do resultado produzido diverge do tipo esperado pelo consumidor (ex: `array` vs `object`). |
| **`AIK-RESULT-002`** | `MissingRequiredResultProperty` | Covariância de Propriedades | O consumidor exige a propriedade `P` no resultado, mas o provedor a declara como opcional ou ausente. |
| **`AIK-SCHEMA-001`** | `UnsupportedSchemaConstruct` | Avaliabilidade do Schema | O schema contém regras além do subconjunto seguro (ex: `not`, recursão, regex complexa). Retorna `unknown`. |

---

## 6. Interface da CLI e Códigos de Saída

### Comando Principal
```bash
aik check --provider <caminho-provider.json> --consumer <caminho-consumer.json> [opções]
```

### Opções:
- `-c, --context <perfil>`: Perfil de contexto a ser avaliado (padrão: `"default"`).
- `-f, --format <formato>`: Formato do relatório (`terminal`, `json`, `junit`). Padrão: `terminal`.
- `-o, --output <arquivo>`: Grava o relatório no caminho especificado em vez do stdout.
- `--strict`: Trata resultados `unknown` como falha de build.

### Códigos de Saída (Exit Codes):
- **`0`**: `PASS` — Todos os contratos compatíveis.
- **`1`**: `FAIL` — Incompatibilidade funcional ou quebra de contrato detectada.
- **`2`**: `ERROR` / `UNKNOWN` — Evidência insuficiente, arquivo ausente, JSON inválido ou schema não analisável.

---

## 7. Skill de Agente para Geração de Contratos (`SKILL.md`)

A pasta `skills/generate-contracts/SKILL.md` conterá as instruções formais para assistentes de código AI:
- **Extração C# / .NET MAF**: Identificar classes de plugins/ferramentas e métodos decorados com `AIFunction` ou `[Description]`, extraindo parâmetros e tipos de retorno.
- **Extração TypeScript / React**: Identificar chamadas a `useCopilotAction` e os pontos de desestruturação das respostas de tools na UI.
- **Produção Automática**: Escrever os arquivos `aik.provider.json` e `aik.consumer.json` com schemas canônicos e compatíveis.

---

## 8. Critérios de Aceite para o Marco M1

1. Executar `aik check` contra as 6 fixtures de teste e obter os exit codes esperados (`0` para válidos, `1` para quebras de retorno/argumentos/tools, `2` para schemas não analisáveis).
2. O validador não emite falso positivo para tipos alterados de resultado.
3. Todos os diagnósticos contêm código estruturado (`AIK-*`), localização do campo e descrição clara do impacto no chat.
4. Suíte de testes automatizados com cobertura > 90% em `src/contracts` e `src/core`.
5. Build limpo gerando tipos TypeScript (`.d.ts`) e binário executável funcional.
