import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { installDiffViewTools } from "./renderer/tool/diff/index.ts";

export default function diffView(pi: ExtensionAPI): void {
  const store = installDiffViewTools(pi);
  pi.on("session_shutdown", async () => store.clear());
}
