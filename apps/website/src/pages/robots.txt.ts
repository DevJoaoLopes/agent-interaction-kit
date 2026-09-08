export function GET({ site }: { site: URL | undefined }) {
  const production = import.meta.env.VERCEL_ENV === "production" && site;
  return new Response(
    production
      ? `User-agent: *\nAllow: /\nSitemap: ${new URL("sitemap.xml", site)}\n`
      : "User-agent: *\nDisallow: /\n",
    { headers: { "Content-Type": "text/plain" } },
  );
}
