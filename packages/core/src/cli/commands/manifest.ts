import fs from "node:fs";
import path from "node:path";
import { type AgUiToolLike, fromAgUiTools } from "../../ag-ui/index.js";
import {
  type ToolFromJsonSchemaInput,
  createProviderManifest,
  toolFromJsonSchema,
} from "../../builders/index.js";
import { parseProviderManifest } from "../../contracts/parser.js";
import type { ExecutionSide, ToolDescriptor } from "../../contracts/types.js";

export interface ManifestCommandOptions {
  from: string;
  input: string;
  side?: string;
  output?: string;
  executionSide?: string;
  producerName?: string;
  producerVersion?: string;
  buildId?: string;
  protocolProfile?: string;
  contextProfile?: string;
}

const SOURCES = ["tools-json", "ag-ui"] as const;
const SIDES = ["provider"] as const;
const EXECUTION_SIDES = ["backend", "frontend"] as const;

const DEFAULT_PROTOCOL_PROFILE = "ag-ui@0.1";
const DEFAULT_CONTEXT_PROFILE = "default";

class ManifestInputError extends Error {}

type Source = (typeof SOURCES)[number];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function oneOf<T extends string>(value: string, allowed: readonly T[]): value is T {
  return (allowed as readonly string[]).includes(value);
}

function nonEmptyString(value: unknown): string | undefined {
  return typeof value === "string" && value !== "" ? value : undefined;
}

function readInput(file: string): unknown {
  if (!fs.existsSync(file)) {
    throw new ManifestInputError(`Input file not found: "${file}"`);
  }
  try {
    return JSON.parse(fs.readFileSync(file, "utf-8"));
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new ManifestInputError(`Input file is not valid JSON: "${file}" (${reason})`);
  }
}

function extractTools(data: unknown): unknown[] {
  const tools = Array.isArray(data) ? data : isRecord(data) ? data.tools : undefined;
  if (!Array.isArray(tools)) {
    throw new ManifestInputError(
      'Unsupported input: expected an array of tools or an object with a "tools" array.',
    );
  }
  return tools;
}

function requireTools(tools: unknown[]): Record<string, unknown>[] {
  return tools.map((tool, index) => {
    if (!isRecord(tool) || nonEmptyString(tool.name) === undefined) {
      throw new ManifestInputError(`tools[${index}]: "name" must be a non-empty string.`);
    }
    return tool;
  });
}

function parametersOf(tool: Record<string, unknown>): Record<string, unknown> {
  if (tool.parameters === undefined || tool.parameters === null) {
    return { type: "object", properties: {} };
  }
  if (!isRecord(tool.parameters)) {
    throw new ManifestInputError(`tool "${tool.name}": "parameters" must be a JSON Schema object.`);
  }
  return tool.parameters;
}

function returnsOf(tool: Record<string, unknown>): ToolFromJsonSchemaInput["returns"] {
  if (tool.returns === undefined) {
    return undefined;
  }
  if (!isRecord(tool.returns)) {
    throw new ManifestInputError(`tool "${tool.name}": "returns" must be an object.`);
  }
  return tool.returns as ToolFromJsonSchemaInput["returns"];
}

function fromToolsJson(
  tools: Record<string, unknown>[],
  defaultSide: ExecutionSide | undefined,
): ToolDescriptor[] {
  return tools.map((tool) => {
    const side = tool.executionSide ?? defaultSide;
    if (side === undefined) {
      throw new ManifestInputError(
        `tool "${tool.name}": "executionSide" is missing. Set it on the tool or pass --execution-side.`,
      );
    }
    const returns = returnsOf(tool);
    return toolFromJsonSchema({
      name: tool.name as string,
      executionSide: side as ExecutionSide,
      ...(typeof tool.description === "string" ? { description: tool.description } : {}),
      parameters: parametersOf(tool),
      ...(returns ? { returns } : {}),
      ...(typeof tool.requiresApproval === "boolean"
        ? { requiresApproval: tool.requiresApproval }
        : {}),
    });
  });
}

function resolveProducer(
  options: ManifestCommandOptions,
  fromFile: Record<string, unknown>,
): { name: string; version: string; buildId: string } {
  const filed = isRecord(fromFile.producer) ? fromFile.producer : {};
  const name = options.producerName ?? nonEmptyString(filed.name);
  const version = options.producerVersion ?? nonEmptyString(filed.version);
  const buildId = options.buildId ?? nonEmptyString(filed.buildId);
  if (name === undefined || version === undefined || buildId === undefined) {
    throw new ManifestInputError(
      'The manifest needs a producer. Pass --producer-name, --producer-version and --build-id, or set "producer" ({ name, version, buildId }) in a tools-json object.',
    );
  }
  return { name, version, buildId };
}

function buildManifest(source: Source, data: unknown, options: ManifestCommandOptions): string {
  const tools = requireTools(extractTools(data));
  const executionSide = options.executionSide as ExecutionSide | undefined;
  const fromFile = source === "tools-json" && isRecord(data) ? data : {};

  const descriptors =
    source === "tools-json"
      ? fromToolsJson(tools, executionSide)
      : fromAgUiTools(
          tools.map(
            (tool): AgUiToolLike => ({
              name: tool.name as string,
              ...(typeof tool.description === "string" ? { description: tool.description } : {}),
              parameters: tool.parameters,
            }),
          ),
          executionSide ? { executionSide } : {},
        );

  const manifest = createProviderManifest({
    ...(typeof fromFile.schemaVersion === "string"
      ? { schemaVersion: fromFile.schemaVersion }
      : {}),
    producer: resolveProducer(options, fromFile),
    protocolProfile:
      options.protocolProfile ??
      nonEmptyString(fromFile.protocolProfile) ??
      DEFAULT_PROTOCOL_PROFILE,
    contextProfile:
      options.contextProfile ?? nonEmptyString(fromFile.contextProfile) ?? DEFAULT_CONTEXT_PROFILE,
    tools: descriptors,
  });

  const json = `${JSON.stringify(manifest, null, 2)}\n`;
  const parsed = parseProviderManifest(json);
  if (!parsed.ok) {
    throw new ManifestInputError(
      `The generated manifest is not valid:\n${parsed.errors.join("\n")}`,
    );
  }
  return json;
}

export async function runManifest(options: ManifestCommandOptions): Promise<number> {
  try {
    if (!oneOf(options.from, SOURCES)) {
      throw new ManifestInputError(
        `Unsupported --from "${options.from}". Use one of: ${SOURCES.join(", ")}.`,
      );
    }
    if (options.side !== undefined && !oneOf(options.side, SIDES)) {
      throw new ManifestInputError(
        `Unsupported --side "${options.side}". Use one of: ${SIDES.join(", ")}.`,
      );
    }
    if (options.executionSide !== undefined && !oneOf(options.executionSide, EXECUTION_SIDES)) {
      throw new ManifestInputError(
        `Unsupported --execution-side "${options.executionSide}". Use one of: ${EXECUTION_SIDES.join(", ")}.`,
      );
    }

    const json = buildManifest(options.from, readInput(options.input), options);

    if (options.output) {
      fs.mkdirSync(path.dirname(options.output), { recursive: true });
      fs.writeFileSync(options.output, json, "utf-8");
    } else {
      console.log(json.trimEnd());
    }
    return 0;
  } catch (error) {
    if (error instanceof ManifestInputError || error instanceof TypeError) {
      console.error(`[AIK-ERROR] ${error.message}`);
      return 2;
    }
    throw error;
  }
}
