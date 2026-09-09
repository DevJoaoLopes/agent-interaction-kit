import { createCli } from "../src/cli/index.js";

await createCli().parseAsync(process.argv);
