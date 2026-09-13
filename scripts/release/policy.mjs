const versionPattern = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-beta\.([1-9]\d*))?$/;

export function channelFor(version) {
  if (!versionPattern.test(version)) throw new Error(`Unsupported release version: ${version}`);
  return version.includes("-beta.") ? "next" : "latest";
}

export function validateTag(tag, version) {
  const channel = channelFor(version);
  if (tag !== `v${version}`) throw new Error("Release tag does not match package version");
  return channel;
}

export { compareSemver, parseSemver } from "./publish-decision.mjs";
