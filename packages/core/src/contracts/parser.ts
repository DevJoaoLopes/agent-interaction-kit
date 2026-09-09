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

export function parseProviderManifest(input: string | object): Result<ProviderManifest> {
  let parsed: unknown;
  try {
    parsed = typeof input === "string" ? JSON.parse(input) : input;
  } catch (err) {
    return { ok: false, errors: [`Invalid JSON in provider manifest: ${(err as Error).message}`] };
  }

  const valid = validateProvider(parsed);
  if (!valid) {
    return {
      ok: false,
      errors: (validateProvider.errors || []).map((error: ErrorObject) =>
        formatValidationError("Provider manifest", error),
      ),
    };
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
