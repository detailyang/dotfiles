import { readFileSync } from "node:fs";

export interface DomainProxyConfig {
  enabled: boolean;
  proxy: string;
  domains: string[];
}

export function normalizeProxyUrl(value: unknown): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error("domain-proxy: proxy must be a non-empty HTTP(S) proxy URL");
  }
  let url: URL;
  try {
    const input = value.trim();
    url = new URL(input.includes("://") ? input : `http://${input}`);
  } catch {
    throw new Error("domain-proxy: invalid proxy URL");
  }
  if (!["http:", "https:"].includes(url.protocol) || !url.hostname ||
      url.pathname !== "/" || url.search || url.hash) {
    // Do not echo the input: URLs may contain proxy credentials.
    throw new Error("domain-proxy: use an HTTP(S) proxy URL without a path, query, or fragment");
  }
  return url.toString();
}

function normalizeDomain(value: unknown): string {
  if (typeof value !== "string") throw new Error("domain-proxy: domains must contain hostnames");
  const pattern = value.trim().toLowerCase().replace(/\.$/, "");
  const hostname = pattern.startsWith("*.") ? pattern.slice(2) : pattern;
  if (!hostname || hostname.length > 253 || !hostname.split(".").every((label) =>
    /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(label))) {
    throw new Error("domain-proxy: use exact hostnames or *.example.com, not URLs, ports or bare wildcards");
  }
  return pattern;
}

export function matchesDomain(hostname: string, domains: readonly string[]): boolean {
  const host = hostname.toLowerCase().replace(/\.$/, "");
  return domains.some((pattern) => pattern.startsWith("*.")
    ? host.endsWith(pattern.slice(1))
    : host === pattern);
}

export function loadDomainProxyConfig(path: string): DomainProxyConfig {
  let text: string;
  try {
    text = readFileSync(path, "utf8");
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code !== "ENOENT") throw new Error(`domain-proxy: cannot read ${path} (${code ?? "unknown error"})`);
    text = "{}";
  }
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    throw new Error(`domain-proxy: invalid JSON in ${path}`);
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("domain-proxy: configuration must be a JSON object");
  }
  const input = value as Record<string, unknown>;
  if (Object.keys(input).some((key) => !["enabled", "proxy", "domains"].includes(key))) {
    throw new Error("domain-proxy: supported configuration keys are enabled, proxy, domains");
  }
  const enabled = input.enabled === undefined ? true : input.enabled;
  const domains = input.domains === undefined ? ["chatgpt.com", "*.chatgpt.com", "auth.openai.com"] : input.domains;
  if (typeof enabled !== "boolean") throw new Error("domain-proxy: enabled must be a boolean");
  if (!Array.isArray(domains)) throw new Error("domain-proxy: domains must be an array of hostnames");
  return {
    enabled,
    proxy: normalizeProxyUrl(input.proxy === undefined ? "http://127.0.0.1:7890" : input.proxy),
    domains: [...new Set(domains.map(normalizeDomain))],
  };
}

export function describeDomainProxy(config: DomainProxyConfig, path: string): string {
  const url = new URL(config.proxy);
  const proxy = `${url.protocol}//${url.username || url.password ? "***@" : ""}${url.host}`;
  return `Domain proxy: ${config.enabled ? "enabled" : "disabled"}\n`
    + `Proxy: ${proxy}\nDomains: ${config.domains.join(", ") || "none"}\n`
    + `Scope: Pi global fetch + WebSocket (no model/provider filter)\nConfig: ${path}\n`
    + "Edits apply to new HTTP requests and WebSocket connections; reload to reconnect existing sockets.";
}
