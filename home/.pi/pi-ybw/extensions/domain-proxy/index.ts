import { join } from "node:path";
import { getAgentDir, type ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { describeDomainProxy, loadDomainProxyConfig } from "./config.ts";
import { installDomainProxy } from "./runtime.ts";

export default function (pi: ExtensionAPI) {
  const path = join(getAgentDir(), "domain-proxy.json");
  const uninstall = installDomainProxy(path);
  pi.on("session_shutdown", uninstall);
  pi.registerCommand("domain-proxy", {
    description: "Show hostname-based HTTP and WebSocket proxy rules",
    handler: async (_args, ctx) => {
      try {
        ctx.ui.notify(describeDomainProxy(loadDomainProxyConfig(path), path), "info");
      } catch (error) {
        ctx.ui.notify(error instanceof Error ? error.message : "domain-proxy: configuration error", "error");
      }
    },
  });
}
