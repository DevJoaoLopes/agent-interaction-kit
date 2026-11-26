import _Ajv, { type ErrorObject } from "ajv";
import { consumerExpectationsSchema, providerManifestSchema } from "./schemas.js";
import type { ConsumerExpectations, ProviderManifest, Result } from "./types.js";

// Handle CJS/ESM interop in NodeNext for Ajv
// biome-ignore lint/suspicious/noExplicitAny: Ajv CJS/ESM interop
const AjvConstructor = ((_Ajv as any).default ?? _Ajv) as { new (opts?: any): any };
const ajv = new AjvConstructor({ allErrors: true });
const validateProvider = ajv.compile(providerManifestSchema);
const validateConsumer = ajv.compile(consumerExpectationsSchema);

function formatValidationError(subject: string, error: ErrorObject): string {
  const location = error.instancePath || "(root)";
  return `${subject}: Validation error at ${location}: ${error.message}`;
}

function formatCustomError(subject: string, message: string): string {
  return `${subject}: ${message}`;
}

function collectProviderToolErrors(parsed: object): string[] {
  const tools = (parsed as { tools?: unknown }).tools;
  if (!Array.isArray(tools)) {
    return [];
  }
  const errors: string[] = [];
  const seen = new Set<string>();
  for (const [index, tool] of tools.entries()) {
    if (!tool || typeof tool !== "object") {
      continue;
    }
    const record = tool as { name?: unknown; parameters?: unknown };
    if (typeof record.name === "string") {
      if (seen.has(record.name)) {
        errors.push(
          formatCustomError("Provider manifest", `Duplicate tool name "${record.name}".`),
        );
      }
      seen.add(record.name);
    }
    const parameters = record.parameters;
    if (parameters && typeof parameters === "object") {
      const type = (parameters as { type?: unknown }).type;
      if (type !== undefined && type !== "object") {
        errors.push(
          formatCustomError(
            "Provider manifest",
            `Validation error at /tools/${index}/parameters/type: must be equal to "object"`,
          ),
        );
      }
    }
  }
  return errors;
}

export function parseProviderManifest(input: string | object): Result<ProviderManifest> {
  let parsed: unknown;
  try {
    parsed = typeof input === "string" ? JSON.parse(input) : input;
  } catch (err) {
    return { ok: false, errors: [`Invalid JSON in provider manifest: ${(err as Error).message}`] };
  }

  const valid = validateProvider(parsed);
  const errors: string[] = [];
  if (!valid) {
    errors.push(
      ...(validateProvider.errors || []).map((error: ErrorObject) =>
        formatValidationError("Provider manifest", error),
      ),
    );
  }
  if (parsed && typeof parsed === "object") {
    errors.push(...collectProviderToolErrors(parsed));
  }
  if (errors.length > 0) {
    return { ok: false, errors };
  }

  return { ok: true, data: parsed as ProviderManifest };
}

export function parseConsumerExpectations(input: string | object): Result<ConsumerExpectations> {
  let parsed: unknown;
  try {
    parsed = typeof input === "string" ? JSON.parse(input) : input;
  } catch (err) {
    return {
      ok: false,
      errors: [`Invalid JSON in consumer expectations: ${(err as Error).message}`],
    };
  }

  const valid = validateConsumer(parsed);
  if (!valid) {
    return {
      ok: false,
      errors: (validateConsumer.errors || []).map((error: ErrorObject) =>
        formatValidationError("Consumer expectations", error),
      ),
    };
  }

  return { ok: true, data: parsed as ConsumerExpectations };
}
