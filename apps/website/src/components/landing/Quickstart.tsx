import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useState } from "react";
const localInstall =
  "git clone https://github.com/DevJoaoLopes/agent-interaction-kit.git\ncd agent-interaction-kit\npnpm install --frozen-lockfile\npnpm build:core";
const localCheck =
  "pnpm --filter @agent-interaction-kit/core aik check \\\n  --provider aik.provider.json \\\n  --consumer aik.consumer.json --strict";

export default function Quickstart({ version }: { version: string }) {
  const isUnreleased = version === "unreleased";
  const install = isUnreleased
    ? localInstall
    : `npm install --save-dev --save-exact @agent-interaction-kit/core@${version}`;
  const check = isUnreleased
    ? localCheck
    : "npx --no-install aik check \\\n  --provider aik.provider.json \\\n  --consumer aik.consumer.json --strict";

  const [tab, setTab] = useState("install");
  const [message, setMessage] = useState("");
  async function copy() {
    try {
      await navigator.clipboard.writeText(tab === "install" ? install : check);
      setMessage("Copied");
    } catch {
      setMessage("Select and copy the command below.");
    }
  }
  return (
    <Tabs
      value={tab}
      onValueChange={(value) => {
        setTab(value);
        setMessage("");
      }}
    >
      <div className="quickstart-controls">
        <TabsList aria-label="Quickstart commands">
          <TabsTrigger value="install">
            {isUnreleased ? "1. Build locally" : "1. Install"}
          </TabsTrigger>
          <TabsTrigger value="check">2. Run check</TabsTrigger>
        </TabsList>
        <button className="copy-button" type="button" onClick={copy}>
          Copy command
        </button>
      </div>
      <TabsContent value="install" forceMount hidden={tab !== "install"}>
        <pre className="code-block">
          <code data-doc-command="quickstart-install">{install}</code>
        </pre>
      </TabsContent>
      <TabsContent value="check" forceMount hidden={tab !== "check"}>
        <pre className="code-block">
          <code data-doc-command="quickstart-check">{check}</code>
        </pre>
      </TabsContent>
      <output className="copy-status">{message}</output>
    </Tabs>
  );
}
