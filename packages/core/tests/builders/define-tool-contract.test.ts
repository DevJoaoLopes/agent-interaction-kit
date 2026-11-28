import type { StandardSchemaV1 } from "@standard-schema/spec";
import { describe, expect, expectTypeOf, it } from "vitest";
import { z } from "zod";
import {
  createConsumerExpectations,
  createProviderManifest,
  defineToolContract,
  toolFromJsonSchema,
} from "../../src/builders/index.js";
import { evaluateCompatibility } from "../../src/core/compatibility.js";
import { toJsonSchema } from "../../src/standard-schema/index.js";

// The shape CopilotKit v2 `useFrontendTool` accepts: name, optional description,
// a Standard Schema for parameters, and a handler whose args match the schema output.
type FrontendToolLike<T extends Record<string, unknown>> = {
  name: string;
  description?: string;
  parameters?: StandardSchemaV1<unknown, T>;
  handler?: (args: T) => Promise<unknown>;
};

const parameters = z.object({
  city: z.string(),
  units: z.enum(["c", "f"]).default("c"),
});
const returns = z.object({ temperature: z.number(), summary: z.string() });

describe("defineToolContract", () => {
  it("returns an object that useFrontendTool accepts once a handler is added", () => {
    const contract = defineToolContract({
      name: "getWeather",
      description: "Get the weather for a city",
      parameters,
      returns,
    });
    const tool: FrontendToolLike<{ city: string; units: "c" | "f" }> = {
      ...contract.tool,
      handler: async ({ city }) => ({ temperature: 21, summary: city }),
    };
    expect(tool.name).toBe("getWeather");
    expect(tool.description).toBe("Get the weather for a city");
    expect(tool.parameters).toBe(parameters);
    expectTypeOf(contract.tool.parameters).toEqualTypeOf<typeof parameters>();
    expectTypeOf(contract.tool).toMatchTypeOf<
      FrontendToolLike<{ city: string; units: "c" | "f" }>
    >();
    // A handler typed with the wrong argument must not type-check:
    // @ts-expect-error city is a string, not a number
    const _wrong: FrontendToolLike<{ city: number }> = { ...contract.tool };
    void _wrong;
  });

  it("builds a frontend ConsumerRequirement from the input and output schemas", () => {
    const contract = defineToolContract({ name: "getWeather", parameters, returns });
    const expectedParameters = toJsonSchema(parameters, "input");
    const expectedReturns = toJsonSchema(returns, "output");
    expect(expectedParameters.ok && expectedReturns.ok).toBe(true);
    if (!expectedParameters.ok || !expectedReturns.ok) {
      return;
    }
    expect(contract.requirement).toEqual({
      toolName: "getWeather",
      executionSide: "frontend",
      expectedParameters: expectedParameters.data,
      expectedReturns: { format: "json", schema: expectedReturns.data },
    });
    expect(contract.requirement.expectedParameters?.required).toEqual(["city"]);
  });

  it("omits expectedReturns when returns is not declared and passes fallbackPolicy through", () => {
    const contract = defineToolContract({
      name: "openDialog",
      parameters: z.object({}),
      fallbackPolicy: "silent-ignore",
    });
    expect(contract.requirement.expectedReturns).toBeUndefined();
    expect(contract.requirement.fallbackPolicy).toBe("silent-ignore");
    expect(contract.tool.description).toBeUndefined();
  });

  it("supports backend tools rendered with useRenderTool", () => {
    const contract = defineToolContract({
      name: "searchDocs",
      executionSide: "backend",
      parameters: z.object({ query: z.string() }),
    });
    expect(contract.requirement.executionSide).toBe("backend");
  });

  it("throws a TypeError when the schema cannot be converted or is not an object", () => {
    expect(() => defineToolContract({ name: "a", parameters: z.string() })).toThrow(TypeError);
    expect(() => defineToolContract({ name: "a", parameters: z.string() })).toThrow(/object/);
    expect(() => defineToolContract({ name: "a", parameters: z.object({ at: z.date() }) })).toThrow(
      /Date cannot be represented/,
    );
  });

  it("produces a requirement that evaluateCompatibility accepts against a matching provider", () => {
    const contract = defineToolContract({ name: "getWeather", parameters, returns });
    const providerParameters = toJsonSchema(parameters, "input");
    const providerReturns = toJsonSchema(returns, "output");
    if (!providerParameters.ok || !providerReturns.ok) {
      throw new Error("conversion failed");
    }
    const provider = createProviderManifest({
      producer: { name: "backend", version: "1.0.0", buildId: "b1" },
      protocolProfile: "ag-ui@0.1",
      contextProfile: "default",
      tools: [
        toolFromJsonSchema({
          name: "getWeather",
          executionSide: "frontend",
          parameters: providerParameters.data,
          returns: { format: "json", schema: providerReturns.data },
        }),
      ],
    });
    const consumer = createConsumerExpectations({
      consumer: { name: "frontend", version: "1.0.0", buildId: "c1" },
      protocolProfile: "ag-ui@0.1",
      contextProfile: "default",
      requires: [contract.requirement],
    });
    const report = evaluateCompatibility(provider, consumer);
    expect(report.status).toBe("pass");
  });
});
