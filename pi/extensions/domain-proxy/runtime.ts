import {
  fetch as undiciFetch, getGlobalDispatcher, ProxyAgent, Request as UndiciRequest, WebSocket,
  type Dispatcher, type RequestInit as UndiciRequestInit, type WebSocketInit,
} from "undici";
import { loadDomainProxyConfig, matchesDomain } from "./config.ts";

/** Route by network destination, below every model/provider and across redirects. */
export function createDomainProxy(configPath: string) {
  const agents = new Map<string, ProxyAgent>();
  let closed = false;

  function route(fallback: Dispatcher = getGlobalDispatcher()): Dispatcher {
    if (closed) throw new Error("domain-proxy: extension is closed");
    // Snapshot once per HTTP request / WebSocket handshake, not per stream chunk.
    // Invalid config rejects requests instead of silently changing network routes.
    const config = loadDomainProxyConfig(configPath);
    return fallback.compose(() => (options, handler) => {
      if (closed) throw new Error("domain-proxy: extension is closed");
      const host = new URL(String(options.origin)).hostname;
      if (!config.enabled || !matchesDomain(host, config.domains)) {
        return fallback.dispatch(options, handler);
      }
      let agent = agents.get(config.proxy);
      if (!agent) {
        agent = new ProxyAgent(config.proxy);
        agents.set(config.proxy, agent);
      }
      return agent.dispatch(options, handler);
    });
  }

  const fetch: typeof globalThis.fetch = async (input, init) => {
    // Node's bundled Request and npm Undici's Request have different brands.
    // Convert only cross-implementation Requests, preserving body/signal/options.
    const request = typeof input === "object" && "url" in input && !(input instanceof UndiciRequest)
      ? new UndiciRequest(input.url, input as unknown as UndiciRequestInit)
      : input;
    const options = init as UndiciRequestInit | undefined;
    return await undiciFetch(request as Parameters<typeof undiciFetch>[0], {
      ...options,
      dispatcher: route(options?.dispatcher),
    }) as unknown as Response;
  };

  class DomainProxyWebSocket extends WebSocket {
    constructor(url: string | URL, protocols?: string | string[] | WebSocketInit) {
      const options = typeof protocols === "object" && !Array.isArray(protocols) && protocols !== null
        ? protocols : { protocols };
      // Preserve headers and subprotocols, including Codex's authenticated upgrade.
      super(url, { ...options, dispatcher: route(options.dispatcher) });
    }
  }

  return {
    fetch,
    WebSocket: DomainProxyWebSocket as unknown as typeof globalThis.WebSocket,
    async close(): Promise<void> {
      closed = true;
      // Only destroy owned proxy connections, never the borrowed normal dispatcher.
      const pending = [...agents.values()].map((agent) => agent.destroy());
      agents.clear();
      await Promise.all(pending);
    },
  };
}

export function installDomainProxy(configPath: string) {
  const originalFetch = globalThis.fetch;
  const originalWebSocket = globalThis.WebSocket;
  const proxy = createDomainProxy(configPath);
  globalThis.fetch = proxy.fetch;
  globalThis.WebSocket = proxy.WebSocket;
  return async () => {
    // A later extension may own the globals now; do not overwrite its changes.
    if (globalThis.fetch === proxy.fetch) globalThis.fetch = originalFetch;
    if (globalThis.WebSocket === proxy.WebSocket) globalThis.WebSocket = originalWebSocket;
    await proxy.close();
  };
}
