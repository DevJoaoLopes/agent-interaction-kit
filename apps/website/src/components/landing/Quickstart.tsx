import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useState } from "react";
const install =
  "git clone https://github.com/DevJoaoLopes/agent-interaction-kit.git\ncd agent-interaction-kit\npnpm install --frozen-lockfile\npnpm build:core";
const check =
  "pnpm --filter @agent-interaction-kit/core aik check \\\n  --provider aik.provider.json \\\n  --consumer aik.consumer.json --strict";
export default function Quickstart() {
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
          <TabsTrigger value="install">1. Build locally</TabsTrigger>
          <TabsTrigger value="check">2. Run check</TabsTrigger>
        </TabsList>
        <button className="copy-button" type="button" onClick={copy}>
          Copy command
        </button>
      </div>
      <TabsContent value="install">
        <pre className="code-block">
          <code>{install}</code>
        </pre>
      </TabsContent>
      <TabsContent value="check">
        <pre className="code-block">
          <code>{check}</code>
        </pre>
      </TabsContent>
      <output className="copy-status">{message}</output>
    </Tabs>
  );
}
