const version = import.meta.env.PUBLIC_AIK_VERSION || "unreleased";
const production = import.meta.env.VERCEL_ENV === "production";
const siteSha = import.meta.env.PUBLIC_SITE_SHA || "local";
const releaseTag = import.meta.env.PUBLIC_AIK_RELEASE_TAG || "";
const channel = version.includes("-beta.") ? "next" : "latest";

if (
  production &&
  (version === "unreleased" || siteSha === "local" || releaseTag !== `v${version}`)
) {
  throw new Error("Production requires verified release and source metadata");
}

export const releaseInfo = {
  version,
  channel,
  releaseTag,
  siteSha,
  experimental: channel === "next",
};
