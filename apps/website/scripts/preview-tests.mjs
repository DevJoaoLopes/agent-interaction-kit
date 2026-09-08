import { preview } from "astro";
// Use the API so Playwright owns a foreground server even in agent environments.
const server = await preview({ server: { host: "127.0.0.1", port: 4322 } });
for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, async () => {
    await server.stop();
    process.exit(0);
  });
}
