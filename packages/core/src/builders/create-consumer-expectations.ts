import type { ConsumerExpectations, ConsumerRequirement } from "../contracts/types.js";

export interface CreateConsumerExpectationsInput {
  $schema?: string;
  schemaVersion?: string;
  consumer: ConsumerExpectations["consumer"];
  protocolProfile: string;
  contextProfile: string;
  requires: readonly ConsumerRequirement[];
}

export function createConsumerExpectations(
  input: CreateConsumerExpectationsInput,
): ConsumerExpectations {
  const manifest: ConsumerExpectations = {
    schemaVersion: input.schemaVersion ?? "1.0.0",
    consumer: { ...input.consumer },
    protocolProfile: input.protocolProfile,
    contextProfile: input.contextProfile,
    requires: input.requires.map((requirement) => ({
      ...requirement,
      ...(requirement.expectedParameters !== undefined
        ? { expectedParameters: { ...requirement.expectedParameters } }
        : {}),
      ...(requirement.expectedReturns !== undefined
        ? { expectedReturns: { ...requirement.expectedReturns } }
        : {}),
    })),
  };
  if (input.$schema !== undefined) {
    manifest.$schema = input.$schema;
  }
  return manifest;
}
