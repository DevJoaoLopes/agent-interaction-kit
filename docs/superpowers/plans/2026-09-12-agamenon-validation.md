# Agamenon Consumer Validation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Demonstrar que um consumidor real instala o AIK do npm, detecta drift de getWeather e continua funcionando no navegador.

**Architecture:** Trabalhar no checkout atual do Agamenon, preservando seu estado e ambientes. Schemas independentes de provider/consumer alimentam um exportador explícito. Os testes invocam o binário instalado; runtime é uma segunda prova com serviços reais, não um substituto dos testes de contrato.

**Tech Stack:** Agamenon pnpm/Turbo, Zod 3, zod-to-json-schema compatível com Zod 3, tsx, Node test runner, AIK npm, Hono/Mastra/CopilotKit, browser automation.

---

## Local e pré-condições

Todos os paths deste plano são relativos a `/Users/joaopiga/Desenvolvimento/agamenon`, exceto o relatório público no AIK.

Usar esse checkout por escolha explícita do mantenedor. Não criar clone ou worktree extra, não sobrescrever `.env`, não executar reset/clean/stash automático. A versão npm exata precisa estar publicada e verificada pelo plano de release; não aceitar `workspace:`, `file:`, symlink ou import do checkout AIK como prova de adoção.

## Mapa de arquivos

- Criar `apps/backend/src/mastra/tools/weather.schemas.ts`: input/output do provider.
- Modificar `apps/backend/src/mastra/tools/weather.ts`: usar os schemas extraídos, mantendo a implementação.
- Criar `apps/frontend/src/lib/weather-contract.ts`: input/output independentes e parser do consumer.
- Modificar `apps/frontend/src/components/WeatherToolRenderer.tsx`: usar/reexportar o parser e schemas.
- Criar `scripts/contracts/weather-manifests.ts`: conversão pura dos schemas para manifests.
- Criar `scripts/contracts/export-weather.ts`: escrita dos manifests gerados.
- Criar `tests/contracts/weather.test.ts`: subprocesso da CLI, baseline/drift/unknown.
- Criar `contracts/aik.provider.json`, `contracts/aik.consumer.json`: gerados, versionados após revisão.
- Modificar `package.json`, `pnpm-lock.yaml`; integrar o comando na CI existente do Agamenon somente após inspecioná-la.
- Criar `docs/aik-adoption.md`: uso no consumidor.
- No AIK, criar `docs/validation/agamenon-release.md`: evidências sanitizadas e limites.

## Task 1: Estado inicial e versão pública

- [ ] Executar no Agamenon:

```bash
git status --short --branch
git rev-parse HEAD
git diff --stat
node --version
pnpm --version
```

Ler AGENTS/instruções; registrar arquivos já modificados. Investigar qualquer sobreposição antes de editar. Não imprimir variáveis de ambiente ou logs de autenticação.

- [ ] Resolver a versão beta através do registro de publicação verificada no AIK e confirmar no npm. Durante a primeira adoção, o exemplo esperado é:

```bash
npm view @agent-interaction-kit/core@1.0.0-beta.1 version dist.integrity dist.tarball --json
pnpm add -Dw --save-exact @agent-interaction-kit/core@1.0.0-beta.1
pnpm exec aik --version
```

Se a beta já avançou, usar a versão exata selecionada e registrar a alteração, sem deixar `@next` flutuante no manifest. Conferir a resolução de registry no lockfile e `pnpm why @agent-interaction-kit/core`.
- [ ] Adicionar devDependencies root `tsx`, `zod@3` e `zod-to-json-schema` numa versão compatível com Zod 3, fixando versões exatas e lockfile. A opção de converter Zod 3 é intencional: não migrar todo o Agamenon para Zod 4 para viabilizar este teste.
- [ ] Rodar apenas testes locais relevantes de schema/formatação e typechecks inicialmente. Não executar `pnpm test` inteiro sem revisar: há testes live que chamam Supabase e inserem notas.

## Task 2: Extrair schemas sem eliminar independência

- [ ] Antes da extração, adicionar teste do parser real `parseWeatherResult` com objeto válido e temperature string inválida; executar a suíte frontend correspondente e verificar resultados.
- [ ] Criar `weather.schemas.ts` no backend com o conteúdo equivalente ao existente:

```typescript
import { z } from "zod";

export const weatherInputSchema = z.object({
  city: z.string().describe("Nome da cidade, ex.: 'São Paulo'"),
});
export const weatherOutputSchema = z.object({
  city: z.string(),
  temperature: z.number(),
  feelsLike: z.number(),
  humidity: z.number(),
  windSpeed: z.number(),
  condition: z.string(),
});
```

- [ ] Em `weather.ts`, substituir somente o import de zod e os literais `inputSchema`/`outputSchema` por imports desses exports. Manter `execute`, fetchWeather, descrições, tipos e mapeamento WMO.
- [ ] Criar `apps/frontend/src/lib/weather-contract.ts`:

```typescript
import { z } from "zod";

export const WeatherParams = z.object({ city: z.string() });
export const WeatherResult = z.object({
  city: z.string(),
  temperature: z.number(),
  feelsLike: z.number(),
  humidity: z.number(),
  windSpeed: z.number(),
  condition: z.string(),
});
export function parseWeatherResult(result: unknown) {
  let value = result;
  if (typeof value === "string") {
    try { value = JSON.parse(value); } catch { return undefined; }
  }
  const parsed = WeatherResult.safeParse(value);
  return parsed.success ? parsed.data : undefined;
}
```

- [ ] No renderer, importar `WeatherParams` e `parseWeatherResult`, remover somente declarações movidas e reexportar `parseWeatherResult` para preservar imports de testes existentes. Não compartilhar `weatherOutputSchema` do backend com o frontend.
- [ ] Rodar `pnpm --filter @agamenon/backend build` e `pnpm --filter @agamenon/frontend build`, além do teste específico do parser. Confirmar nenhum novo import dispara inicialização de DB/LLM no exportador.

## Task 3: Exportação explícita dos contratos reais

- [ ] Criar `scripts/contracts/weather-manifests.ts`:

```typescript
import { createHash } from "node:crypto";
import type { ZodTypeAny } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import { weatherInputSchema, weatherOutputSchema } from "../../apps/backend/src/mastra/tools/weather.schemas";
import { WeatherParams, WeatherResult } from "../../apps/frontend/src/lib/weather-contract";

const options = { target: "jsonSchema7", $refStrategy: "none", removeAdditionalStrategy: "strict" } as const;

export function weatherManifests(output: ZodTypeAny = weatherOutputSchema) {
  const parameters = zodToJsonSchema(weatherInputSchema, options);
  const returns = zodToJsonSchema(output, options);
  const expectedParameters = zodToJsonSchema(WeatherParams, options);
  const expectedReturns = zodToJsonSchema(WeatherResult, options);
  const buildId = createHash("sha256")
    .update(JSON.stringify([parameters, returns, expectedParameters, expectedReturns]))
    .digest("hex");
  return {
    provider: {
      schemaVersion: "1.0.0",
      producer: { name: "agamenon-backend", version: "0.0.0", buildId },
      protocolProfile: "ag-ui@0.1", contextProfile: "weather-contract",
      tools: [{ name: "getWeather", executionSide: "backend", parameters,
        returns: { format: "json", schema: returns } }],
    },
    consumer: {
      schemaVersion: "1.0.0",
      consumer: { name: "agamenon-frontend", version: "0.0.0", buildId },
      protocolProfile: "ag-ui@0.1", contextProfile: "weather-contract",
      requires: [{ toolName: "getWeather", executionSide: "backend", expectedParameters,
        expectedReturns: { format: "json", schema: expectedReturns } }],
    },
  };
}
```

Os nomes de perfil são identificadores deste par de teste, não certificação de compatibilidade completa do runtime AG-UI. `0.0.0` identifica aplicações privadas sem versão própria; buildId é hash dos schemas, inclusive mudanças não commitadas. Não derivar buildId somente do HEAD enquanto se testa mutação local.

- [ ] Confirmar que o parâmetro `output: ZodTypeAny` permite a alteração de tipo de campo nos testes. A API do exportador é deliberadamente pequena e não expõe uma flag de produção para retornar dados inválidos.
- [ ] Criar `export-weather.ts`:

```typescript
import { mkdirSync, writeFileSync } from "node:fs";
import { weatherManifests } from "./weather-manifests";

const { provider, consumer } = weatherManifests();
mkdirSync("contracts", { recursive: true });
writeFileSync("contracts/aik.provider.json", `${JSON.stringify(provider, null, 2)}\n`);
writeFileSync("contracts/aik.consumer.json", `${JSON.stringify(consumer, null, 2)}\n`);
```

- [ ] Adicionar scripts root:

```json
{
  "contracts:generate": "tsx scripts/contracts/export-weather.ts",
  "test:contracts": "pnpm contracts:generate && aik check --provider contracts/aik.provider.json --consumer contracts/aik.consumer.json --context weather-contract --format json --strict",
  "test:contracts:regression": "tsx --test tests/contracts/weather.test.ts"
}
```

- [ ] Executar geração e parser da versão publicada. Verificar schemas não vazios: `properties.temperature.type` deve ser `number` nos dois lados; `required` contém os campos esperados. Converter sem `$ref` não deve resultar silenciosamente em `{}`. `removeAdditionalStrategy: strict` preserva a aceitação de chaves extras dos objetos Zod strip; testar esse comportamento contra o parser real.

## Task 4: Baseline, drift e unknown via CLI instalada

- [ ] Criar teste do subprocesso antes de terminar o exportador, observar falha e depois concluir implementação. Estrutura de `tests/contracts/weather.test.ts`:

```typescript
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { z } from "zod";
import { weatherManifests } from "../../scripts/contracts/weather-manifests";
import { weatherOutputSchema } from "../../apps/backend/src/mastra/tools/weather.schemas";
import { parseWeatherResult } from "../../apps/frontend/src/lib/weather-contract";

function check(pair: ReturnType<typeof weatherManifests>) {
  const dir = mkdtempSync(path.join(os.tmpdir(), "agamenon-aik-"));
  try {
    const provider = path.join(dir, "provider.json");
    const consumer = path.join(dir, "consumer.json");
    writeFileSync(provider, JSON.stringify(pair.provider));
    writeFileSync(consumer, JSON.stringify(pair.consumer));
    const result = spawnSync("pnpm", ["exec", "aik", "check", "--provider", provider,
      "--consumer", consumer, "--context", "weather-contract", "--format", "json", "--strict"],
      { encoding: "utf8", timeout: 30000 });
    assert.equal(result.error, undefined);
    return { code: result.status, report: JSON.parse(result.stdout) };
  } finally { rmSync(dir, { recursive: true, force: true }); }
}
test("published CLI accepts actual weather schemas", () => {
  const result = check(weatherManifests());
  assert.equal(result.code, 0);
  assert.equal(result.report.status, "pass");
});
test("actual consumer rejects the same drift detected by the CLI", () => {
  const result = check(weatherManifests(weatherOutputSchema.extend({ temperature: z.string() })));
  assert.equal(result.code, 1);
  assert.equal(result.report.status, "fail");
  assert.ok(result.report.diagnostics.some((d: { code: string }) => d.code === "AIK-RESULT-003"));
  assert.equal(parseWeatherResult({ city: "São Paulo", temperature: "23", feelsLike: 23,
    humidity: 60, windSpeed: 10, condition: "céu limpo" }), undefined);
});
test("strict rejects an unsupported union", () => {
  const result = check(weatherManifests(weatherOutputSchema.extend({
    temperature: z.union([z.number(), z.string()]),
  })));
  assert.equal(result.code, 2);
  assert.equal(result.report.status, "unknown");
});
```

- [ ] Acrescentar controle de campo adicional de saída aceito, resultado válido aceito pelo parser real e baseline após mutação. Os schemas originais não são mutados por `.extend`; preservar esse fato nos testes.
- [ ] Executar `pnpm test:contracts:regression`, `pnpm test:contracts` e typechecks. Se o AIK publicado não detectar quebra real suportada, registrar bug no AIK, corrigir por novo PR/beta e repetir com a nova versão npm; não trocar por import local para obter verde.
- [ ] Versionar manifests após revisão e, na CI do Agamenon, gerar novamente e executar `git diff --exit-code -- contracts` para detectar manifests desatualizados. Integrar como job sem envs LLM/DB, pois os módulos importados são puros. Investigar o workflow real antes de editar; não substituir toda CI do consumidor.
- [ ] Documentar comandos e interpretação no `docs/aik-adoption.md`. Deixar mudanças locais revisáveis; não fazer push/merge do Agamenon sem instrução explícita.

## Task 5: Runtime no checkout atual

- [ ] Verificar processos/portas existentes e usar os servidores atuais se forem do Agamenon correto. Não matar processos desconhecidos. Se necessário, iniciar `pnpm dev` no diretório indicado e registrar os PIDs criados pelo executor.
- [ ] Confirmar URLs reais nos logs de startup sem expor valores de env. O proxy observado aponta backend em 3000; descobrir porta efetiva do Vite em vez de assumir se ela já estiver ocupada.
- [ ] Usar snapshot de acessibilidade do browser para localizar conversa/input. Criar conversa de teste com identificação `AIK validation <versão>` e perguntar: “Qual é o clima atual em São Paulo? Use a ferramenta de clima.”
- [ ] Verificar resultado real: chamada `getWeather`, argumento city, card com cidade/temperatura numérica/condição, ausência da mensagem “Dados de clima indisponíveis”, ausência de erro de transporte ou console relacionado. Não comparar temperatura atual a valor fixo.
- [ ] Limitar a três tentativas dirigidas. Se LLM/Open-Meteo/DB estiver indisponível, registrar falha externa e evidência, sem classificar automaticamente como bug de contrato e sem retries ilimitados.
- [ ] Para demonstrar quebra runtime, usar edição temporária mínima de output schema + retorno temperature string, depois de registrar o estado dos arquivos. Regenerar manifest e confirmar CLI fail antes de abrir a UI. Se a validação Mastra impedir retorno inválido, registrar essa barreira corretamente em vez de alegar que o renderer recebeu o payload.
- [ ] Restaurar somente as edições temporárias do experimento, preservando integração permanente e mudanças preexistentes. Rodar geração, `test:contracts`, regressões e fluxo válido novamente. Não usar `git checkout -- .` ou reset global como restauração.
- [ ] Não executar save_note ou limpar conversas/notas antigas como parte do cenário de clima. Eventual conversa criada pelo teste fica identificada; exclusão deve usar caminho normal do app e somente o item de teste, se necessário.

## Task 6: Relatório e gate estável

- [ ] No AIK, criar `docs/validation/agamenon-release.md` com:

```text
AIK npm version / dist-tag / integrity / provenance checked
AIK GitHub tag + SHA + workflow run
Agamenon HEAD + list of intentional working-tree changes
Commands run and exit codes
Schema baseline: pass
Breaking temperature change: fail and diagnostic
Unsupported union strict: unknown/2
Runtime: tool invoked, card rendered, observable errors
Restoration: contract and runtime valid again
Website URL + site SHA + documented package version
Known limits / external failures / unexecuted steps
```

- [ ] Armazenar screenshots/relatórios sem credenciais, dados pessoais ou conteúdo de outras conversas. E2E npm prova distribuição e contratos; runtime prova esse fluxo específico, não todos os recursos do Agamenon ou do protocolo AG-UI.
- [ ] Conferir `git status`/diff finais nos dois repositórios. Encerrar só os servidores iniciados para o teste, se não forem mais necessários; não interromper a sessão do usuário.
- [ ] Quando todos os gates beta/OIDC/site/Agamenon estiverem verdes, preparar PR de promoção para `1.0.0` seguindo o plano npm. Apresentar versão/changelog/evidências ao mantenedor e aguardar aprovação do merge estável.
