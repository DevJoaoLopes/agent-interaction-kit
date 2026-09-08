import { consumer, provider } from "../../data/examples";
export function getStaticPaths() {
  return [
    { params: { file: "provider" }, props: { manifest: provider } },
    { params: { file: "consumer" }, props: { manifest: consumer } },
  ];
}
export function GET({ props }: { props: { manifest: unknown } }) {
  return new Response(JSON.stringify(props.manifest, null, 2), {
    headers: { "Content-Type": "application/json" },
  });
}
