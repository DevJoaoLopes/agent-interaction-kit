import { Command } from "commander";
import { AIK_VERSION } from "../index.js";
import { runCheck } from "./commands/check.js";
import { runManifest } from "./commands/manifest.js";

export function createCli(): Command {
  const program = new Command();

  program
    .name("aik")
    .description("Agent Interaction Kit — CDC tool testing for AG-UI applications")
    .version(AIK_VERSION);

  program
    .command("check")
    .description("Check compatibility between provider manifest and consumer expectations")
    .requiredOption("-p, --provider <path>", "Path to provider manifest (aik.provider.json)")
    .requiredOption("-c, --consumer <path>", "Path to consumer expectations (aik.consumer.json)")
    .option("--context <profile>", "Context profile to evaluate", "default")
    .option("-f, --format <format>", "Output format (terminal, json, junit)", "terminal")
    .option("-o, --output <path>", "Write report to file instead of stdout")
    .option("--strict", "Treat unknown/inconclusive schemas as failure", false)
    .action(async (opts) => {
      const exitCode = await runCheck(opts);
      process.exit(exitCode);
    });

  program
    .command("manifest")
    .description("Generate a provider manifest (aik.provider.json) from a tool definition file")
    .argument("<input>", "Path to the tool definition file (JSON)")
    .requiredOption("--from <format>", "Input format: tools-json or ag-ui")
    .option("--side <side>", "Manifest to generate (only provider is supported)", "provider")
    .option(
      "--execution-side <side>",
      "Execution side for tools without one (backend or frontend). ag-ui defaults to frontend",
    )
    .option("--producer-name <name>", "Producer name (overrides the file)")
    .option("--producer-version <version>", "Producer version (overrides the file)")
    .option("--build-id <id>", "Producer build id (overrides the file)")
    .option("--protocol-profile <profile>", "Protocol profile (default ag-ui@0.1)")
    .option("--context-profile <profile>", "Context profile (default default)")
    .option("-o, --output <path>", "Write the manifest to a file instead of stdout")
    .action(async (input: string, opts) => {
      const exitCode = await runManifest({ ...opts, input });
      process.exit(exitCode);
    });

  return program;
}
