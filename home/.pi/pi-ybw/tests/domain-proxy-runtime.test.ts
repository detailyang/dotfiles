import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createServer } from "node:http";
import { once } from "node:events";
import { MockAgent, getGlobalDispatcher, setGlobalDispatcher } from "undici";
import { createDomainProxy, installDomainProxy } from "../extensions/domain-proxy/runtime.ts";

function fixture(t: test.TestContext, config: object = {}) {
  const dir = mkdtempSync(join(tmpdir(), "pi-domain-runtime-"));
  const path = join(dir, "domain-proxy.json");
  writeFileSync(path, JSON.stringify(config));
  const original = getGlobalDispatcher();
  const direct = new MockAgent();
  direct.disableNetConnect();
  setGlobalDispatcher(direct);
  const proxy = createDomainProxy(path);
  t.after(async () => {
    setGlobalDispatcher(original);
    await proxy.close();
    await direct.close();
    rmSync(dir, { recursive: true, force: true });
  });
  return { dir, path, proxy, direct };
}

async function rejectingProxy(t: test.TestContext) {
  const destinations: string[] = [];
  const server = createServer();
  server.on("connect", (req, socket) => {
    destinations.push(req.url!);
    socket.end("HTTP/1.1 407 Proxy Authentication Required\r\nContent-Length: 0\r\nConnection: close\r\n\r\n");
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  t.after(() => new Promise<void>((resolve) => server.close(() => resolve())));
  return { url: `http://127.0.0.1:${(server.address() as { port: number }).port}`, destinations };
}

test("same hostname is proxied for every model, token endpoints and WebSocket", { timeout: 10000 }, async (t) => {
  const upstream = await rejectingProxy(t);
  const { proxy, direct } = fixture(t, { proxy: upstream.url, domains: ["chatgpt.com", "auth.openai.com"] });
  for (const model of ["gpt-5.6-sol", "different-model", "no-model-at-all"]) {
    await assert.rejects(proxy.fetch("https://chatgpt.com/backend-api/codex/responses", {
      method: "POST", body: JSON.stringify({ model }), signal: AbortSignal.timeout(2000),
    }));
  }
  await assert.rejects(proxy.fetch("https://auth.openai.com/oauth/token", { method: "POST", body: "fixture", signal: AbortSignal.timeout(2000) }));
  const socket = new proxy.WebSocket("wss://chatgpt.com/backend-api/codex/responses");
  await new Promise<void>((resolve) => socket.addEventListener("error", () => resolve(), { once: true }));
  assert.deepEqual(upstream.destinations, ["chatgpt.com:443", "chatgpt.com:443", "chatgpt.com:443", "auth.openai.com:443", "chatgpt.com:443"]);
  assert.equal(getGlobalDispatcher(), direct);
});

test("unmatched hostnames, even with the same model, retain the normal dispatcher", async (t) => {
  const { proxy, direct } = fixture(t);
  direct.get("https://unrelated.test").intercept({ path: "/", method: "POST", body: '{"model":"gpt-5.6-sol"}' }).reply(200, "normal route");
  assert.equal(await (await proxy.fetch("https://unrelated.test", { method: "POST", body: '{"model":"gpt-5.6-sol"}' })).text(), "normal route");
  direct.assertNoPendingInterceptors();
});

test("native Request objects preserve POST body, headers and abort signal", async (t) => {
  const { proxy, direct } = fixture(t, { domains: [] });
  const server = createServer(async (req, res) => {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    res.end(JSON.stringify({ method: req.method, header: req.headers["x-test"], body: Buffer.concat(chunks).toString() }));
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  t.after(() => new Promise<void>((resolve) => { server.closeAllConnections(); server.close(() => resolve()); }));
  const address = `127.0.0.1:${(server.address() as { port: number }).port}`;
  direct.enableNetConnect(address);
  const request = new Request(`http://${address}`, { method: "POST", body: "body", headers: { "x-test": "header" } });
  assert.deepEqual(await (await proxy.fetch(request)).json(), { method: "POST", header: "header", body: "body" });
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(proxy.fetch(new Request("https://unrelated.test", { signal: controller.signal })), { name: "AbortError" });
  direct.assertNoPendingInterceptors();
});

test("config changes apply to new requests; the configured proxy has no direct fallback", async (t) => {
  const a = await rejectingProxy(t);
  const b = await rejectingProxy(t);
  const { path, proxy, direct } = fixture(t, { proxy: a.url, domains: ["chatgpt.com"] });
  const first = assert.rejects(proxy.fetch("https://chatgpt.com", { signal: AbortSignal.timeout(2000) }));
  writeFileSync(path, JSON.stringify({ proxy: b.url, domains: ["chatgpt.com"] }));
  const second = assert.rejects(proxy.fetch("https://chatgpt.com", { signal: AbortSignal.timeout(2000) }));
  await Promise.all([first, second]);
  assert.deepEqual(a.destinations, ["chatgpt.com:443"]);
  assert.deepEqual(b.destinations, ["chatgpt.com:443"]);
  writeFileSync(path, '{"enabled":false}');
  direct.get("https://chatgpt.com").intercept({ path: "/" }).reply(200, "disabled");
  assert.equal(await (await proxy.fetch("https://chatgpt.com")).text(), "disabled");
});

test("normal routing uses the latest dispatcher after Pi changes its network settings", async (t) => {
  const { proxy } = fixture(t);
  const replacement = new MockAgent();
  replacement.disableNetConnect();
  t.after(() => replacement.close());
  setGlobalDispatcher(replacement);
  replacement.get("https://unrelated.test").intercept({ path: "/" }).reply(200, "new dispatcher");
  assert.equal(await (await proxy.fetch("https://unrelated.test")).text(), "new dispatcher");
});

test("invalid config blocks requests and closed wrappers cannot reopen connections", async (t) => {
  const { path, proxy } = fixture(t);
  writeFileSync(path, "{");
  await assert.rejects(proxy.fetch("https://chatgpt.com"), /invalid JSON/);
  assert.throws(() => new proxy.WebSocket("wss://chatgpt.com"), /invalid JSON/);
  await proxy.close();
  await assert.rejects(proxy.fetch("https://chatgpt.com"), /closed/);
});

test("installation restores owned globals and does not alter environment or global dispatcher", async (t) => {
  const { path, direct } = fixture(t);
  const originalFetch = globalThis.fetch;
  const originalWebSocket = globalThis.WebSocket;
  const environment = JSON.stringify({ ...process.env });
  const uninstall = installDomainProxy(path);
  assert.notEqual(globalThis.fetch, originalFetch);
  assert.notEqual(globalThis.WebSocket, originalWebSocket);
  assert.equal(getGlobalDispatcher(), direct);
  assert.ok(JSON.stringify({ ...process.env }) === environment, "environment changed");
  await uninstall();
  assert.equal(globalThis.fetch, originalFetch);
  assert.equal(globalThis.WebSocket, originalWebSocket);
  // Teardown must not erase another extension's subsequent changes.
  const uninstallAgain = installDomainProxy(path);
  globalThis.fetch = originalFetch;
  globalThis.WebSocket = originalWebSocket;
  await uninstallAgain();
  assert.equal(globalThis.fetch, originalFetch);
  assert.equal(globalThis.WebSocket, originalWebSocket);
});
