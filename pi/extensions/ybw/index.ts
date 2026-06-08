import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

const EXTRA_TOOLS = ["grep"];

export default function tools(pi: ExtensionAPI): void {
  pi.on("session_start", () => {
    const active = pi.getActiveTools();
    const toAdd = EXTRA_TOOLS.filter((t) => !active.includes(t));
    if (toAdd.length > 0) {
      pi.setActiveTools([...active, ...toAdd]);
    }
  });
}
