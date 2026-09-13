import { defineConfig } from "@playwright/test";

const remote = process.env.SITE_TEST_URL;

export default defineConfig({
  testDir: "./tests",
  fullyParallel: true,
  retries: process.env.CI ? 1 : 0,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: remote || "http://127.0.0.1:4322",
    viewport: { width: 1440, height: 1000 },
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  webServer: remote
    ? undefined
    : {
        command: "node scripts/preview-tests.mjs",
        url: "http://127.0.0.1:4322",
        reuseExistingServer: !process.env.CI,
        env: { ASTRO_TELEMETRY_DISABLED: "1" },
      },
});
