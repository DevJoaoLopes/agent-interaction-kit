import react from "@astrojs/react";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "astro/config";
const production = process.env.VERCEL_ENV === "production";
const origin =
  process.env.SITE_URL ||
  (production && process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : undefined);
export default defineConfig({
  site: origin,
  output: "static",
  integrations: [react()],
  vite: { plugins: [tailwindcss()] },
});
