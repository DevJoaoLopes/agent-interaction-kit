import { Command } from "commander";
import { AIK_VERSION } from "../index.js";
import { runCheck } from "./commands/check.js";

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

  return program;
}
