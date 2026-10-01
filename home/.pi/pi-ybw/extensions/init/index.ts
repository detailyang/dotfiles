import { readFileSync } from "node:fs";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

const INIT_AGENTS_PROMPT = readFileSync(new URL("./prompt.md", import.meta.url), "utf-8").trimEnd();

export default function initExtension(pi: ExtensionAPI): void {
  pi.registerCommand("init", {
    description: "Initialize or update AGENTS.md for this repository",
    handler: async () => {
      pi.sendUserMessage(INIT_AGENTS_PROMPT);
    },
  });
}
