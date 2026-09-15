# Domain proxy

Routes Pi's global `fetch` and `WebSocket` requests by destination hostname,
independent of model, provider, API path and port. No provider registrations or
model definitions are replaced, and no transport is forced to SSE.

## Configuration

Optional file: `~/.pi/agent/domain-proxy.json` (or
`$PI_CODING_AGENT_DIR/domain-proxy.json`). Defaults:

```json
{
  "enabled": true,
  "proxy": "http://127.0.0.1:7890",
  "domains": ["chatgpt.com", "*.chatgpt.com", "auth.openai.com"]
}
```

Exact entries match only that hostname. `*.chatgpt.com` matches subdomains at
any depth but **not** `chatgpt.com` itself. Matching is case-insensitive and
respects DNS label boundaries: `notchatgpt.com` and `chatgpt.com.evil.test` do
not match. Entries are ASCII hostnames (use punycode for international names),
not URLs or host:port pairs. To include every OpenAI subdomain, replace
`auth.openai.com` with `*.openai.com`; add `openai.com` separately for the apex.

HTTP and HTTPS proxies are supported. A bare `127.0.0.1:7890` is normalized to
`http://127.0.0.1:7890`. The localhost address refers to the machine/container
running Pi. Keep authenticated proxy URLs private; `/domain-proxy` redacts them.

The file is read for each new HTTP request and WebSocket handshake. Each request
retains its configuration snapshot, including across redirects. Existing
WebSockets are not migrated when rules change; restart Pi to ensure all
connections are rebuilt. First enable this extension on a fresh Pi process.
Set `enabled` to `false` or `domains` to `[]` to stop applying its proxy rules.
Invalid configuration fails requests explicitly rather than silently bypassing
rules. Only the user-level file is loaded; project files cannot redirect traffic.

## Network boundaries

Matched HTTP(S)/WS(S) destinations use a dedicated Undici `ProxyAgent`. Failure
is reported; there is no fallback to a direct connection. Redirect destinations
are re-evaluated by hostname. Proxy credentials remain on CONNECT requests,
not upstream requests, and TLS certificate verification remains enabled.

Unmatched destinations retain the caller's explicit dispatcher or Pi's current
normal dispatcher. This means they may still use a proxy configured elsewhere;
this extension does **not** force them to be direct. Changing Pi's normal
network settings does not remove the domain routing wrappers.

The extension replaces the **process-local** global `fetch` and `WebSocket`
implementations, not `HTTPS_PROXY`, `NO_PROXY` or the global dispatcher. Its
shutdown handler restores globals it still owns and releases owned proxy
connections without closing the borrowed normal dispatcher.

Pi's ordinary model requests and its OAuth HTTP login/token-refresh requests
are covered when they use these globals. Authentication logic is unchanged.
External browser login pages, shell tools (`curl`, `git`), native `http`/`https`
clients, separately imported network clients and previously captured global
functions are outside this scope. This is not a system-wide VPN or firewall.
Validated with Node.js; a Bun-compiled Pi runtime is not verified.

This replaces the uncommitted `codex-proxy` extension. Its old command and
`codex-proxy.json` model-based configuration are no longer used. Do not load
both implementations.

## Verification

```bash
# From the repository root
node --test pi/tests/domain-proxy*.test.ts
make check-pi
```

Tests use local CONNECT/TLS servers and mock normal dispatchers. They cover
model-independent routing, exact/wildcard domains, config changes, request-body
and abort preservation, proxy errors, native Codex SSE, authenticated WSS,
OAuth endpoint URLs, redirects, Pi network reconfiguration and global cleanup.
The TLS fixture uses an ephemeral CA trusted only in its child process. No real
account, upstream ChatGPT request or system trust-store change is involved.
