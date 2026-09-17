import { releaseInfo } from "../lib/release-info";

export function GET() {
  return new Response(JSON.stringify(releaseInfo), {
    headers: { "Content-Type": "application/json" },
  });
}
