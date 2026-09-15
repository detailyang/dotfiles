import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createServer as httpServer, type Server, type IncomingHttpHeaders } from "node:http";
import { createServer as httpsServer } from "node:https";
import { connect, type Socket } from "node:net";
import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import * as zlib from "node:zlib";

const exec = promisify(execFile);

async function listen(t: test.TestContext, server: Server): Promise<number> {
  const sockets = new Set<Socket>();
  server.on("connection", (socket) => { sockets.add(socket); socket.once("close", () => sockets.delete(socket)); });
  t.after(() => new Promise<void>((resolve) => {
    for (const socket of sockets) socket.destroy();
    server.close(() => resolve());
  }));
  await new Promise<void>((resolve, reject) => { server.once("error", reject); server.listen(0, "127.0.0.1", resolve); });
  return (server.address() as { port: number }).port;
}

test("real TLS CONNECT: native Codex SSE, OAuth URL, WebSocket and cross-domain redirects", { timeout: 30000 }, async (t) => {
  const dir = mkdtempSync(join(tmpdir(), "pi-domain-tls-"));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const key = join(dir, "key.pem");
  const cert = join(dir, "cert.pem");
  try {
    await exec("openssl", ["req", "-x509", "-newkey", "rsa:2048", "-nodes", "-keyout", key, "-out", cert,
      "-subj", "/CN=chatgpt.com", "-addext", "subjectAltName=DNS:chatgpt.com,DNS:auth.openai.com", "-days", "1"], { timeout: 10000 });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") { t.skip("openssl is required for the TLS integration fixture"); return; }
    throw error;
  }
  const requests: { url?: string; headers: IncomingHttpHeaders; body: Buffer }[] = [];
  const upgrades: IncomingHttpHeaders[] = [];
  const item = { id: "msg_test", type: "message", role: "assistant", status: "completed",
    content: [{ type: "output_text", text: "proxy works", annotations: [] }] };
  const upstream = httpsServer({ key: readFileSync(key), cert: readFileSync(cert) }, (req, res) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", () => {
      requests.push({ url: req.url, headers: req.headers, body: Buffer.concat(chunks) });
      if (req.url === "/oauth/token") { res.setHeader("content-type", "application/json"); res.end('{"fixture":true}'); return; }
      if (req.url === "/redirect") { res.writeHead(302, { location: "https://unrelated.test/final" }); res.end(); return; }
      res.writeHead(200, { "content-type": "text/event-stream" });
      for (const event of [
        { type: "response.created", response: { id: "resp_test", status: "in_progress" } },
        { type: "response.output_item.added", output_index: 0, item: { ...item, status: "in_progress", content: [] } },
        { type: "response.content_part.added", output_index: 0, content_index: 0, item_id: "msg_test", part: { type: "output_text", text: "", annotations: [] } },
        { type: "response.output_text.delta", output_index: 0, content_index: 0, item_id: "msg_test", delta: "proxy works" },
        { type: "response.output_item.done", output_index: 0, item },
        { type: "response.completed", response: { id: "resp_test", status: "completed", output: [item], usage: { input_tokens: 5, output_tokens: 2, total_tokens: 7 } } },
      ]) res.write(`data: ${JSON.stringify(event)}\n\n`);
      res.end();
    });
  });
  upstream.on("upgrade", (req, socket) => {
    upgrades.push(req.headers);
    const accept = createHash("sha1").update(`${req.headers["sec-websocket-key"]}258EAFA5-E914-47DA-95CA-C5AB0DC85B11`).digest("base64");
    socket.write(`HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: ${accept}\r\nSec-WebSocket-Protocol: fixture\r\n\r\n`);
    const text = Buffer.from("websocket works");
    socket.write(Buffer.concat([Buffer.from([0x81, text.length]), text]));
    socket.on("data", (data) => { if ((data[0] & 0x0f) === 8) socket.end(Buffer.from([0x88, 0])); });
  });
  const upstreamPort = await listen(t, upstream);
  const destinations: { host?: string; auth?: string }[] = [];
  const proxy = httpServer();
  proxy.on("connect", (req, client, head) => {
    destinations.push({ host: req.url, auth: req.headers["proxy-authorization"] });
    const remote = connect(upstreamPort, "127.0.0.1", () => {
      client.write("HTTP/1.1 200 Connection Established\r\n\r\n");
      if (head.length) remote.write(head);
      client.pipe(remote).pipe(client);
    });
    remote.on("error", () => client.destroy());
    client.on("error", () => remote.destroy());
    client.on("close", () => remote.destroy());
  });
  const proxyPort = await listen(t, proxy);
  const configPath = join(dir, "domain-proxy.json");
  writeFileSync(configPath, JSON.stringify({ proxy: `http://fixture:password@127.0.0.1:${proxyPort}` }));
  const runtimeUrl = new URL("../extensions/domain-proxy/runtime.ts", import.meta.url).href;
  const dispatcherUrl = new URL("../node_modules/@earendil-works/pi-coding-agent/dist/core/http-dispatcher.js", import.meta.url).href;
  const script = `
    import assert from 'node:assert/strict';
    import { MockAgent, getGlobalDispatcher, setGlobalDispatcher } from 'undici';
    import { openaiCodexProvider } from '@earendil-works/pi-ai/providers/openai-codex';
    import { configureHttpDispatcher } from ${JSON.stringify(dispatcherUrl)};
    import { installDomainProxy } from ${JSON.stringify(runtimeUrl)};
    const provider = openaiCodexProvider();
    const model = {...provider.getModels()[0], id:'gpt-5.6-sol'};
    const originalFetch = globalThis.fetch;
    const originalWebSocket = globalThis.WebSocket;
    const uninstall = installDomainProxy(${JSON.stringify(configPath)});
    const installedFetch = globalThis.fetch;
    const installedWebSocket = globalThis.WebSocket;
    configureHttpDispatcher(30000);
    assert.equal(globalThis.fetch, installedFetch);
    assert.equal(globalThis.WebSocket, installedWebSocket);
    const direct = new MockAgent();
    direct.disableNetConnect();
    setGlobalDispatcher(direct);
    direct.get('https://unrelated.test').intercept({path:'/start'}).reply(302, '', {headers:{location:'https://auth.openai.com/oauth/token'}});
    direct.get('https://unrelated.test').intercept({path:'/final'}).reply(200, 'normal route');
    try {
      const claim = Buffer.from(JSON.stringify({'https://api.openai.com/auth':{chatgpt_account_id:'fixture-account'}})).toString('base64url');
      const result = await provider.streamSimple(model, {messages:[{role:'user', content:'hello', timestamp:0}]}, {
        apiKey:'fixture.'+claim+'.fixture', transport:'sse', sessionId:'fixture-session', signal:AbortSignal.timeout(5000),
      }).result();
      assert.equal(result.stopReason, 'stop', result.errorMessage);
      assert.equal(result.content[0].text, 'proxy works');
      assert.deepEqual(await (await fetch('https://auth.openai.com/oauth/token', {method:'POST', body:'fixture'})).json(), {fixture:true});
      assert.deepEqual(await (await fetch('https://unrelated.test/start')).json(), {fixture:true});
      assert.equal(await (await fetch('https://chatgpt.com/redirect')).text(), 'normal route');
      const socket = new WebSocket('wss://chatgpt.com/ws', {protocols:['fixture'], headers:{'x-test':'ws-header'}});
      const text = await new Promise((resolve, reject) => {
        socket.addEventListener('message', e=>resolve(e.data), {once:true});
        socket.addEventListener('error', reject, {once:true});
      });
      assert.equal(text, 'websocket works');
      assert.equal(socket.protocol, 'fixture');
      socket.close();
      direct.assertNoPendingInterceptors();
      console.log('SSE + OAuth URL + WSS + redirects passed');
    } finally {
      await uninstall();
      assert.equal(globalThis.fetch, originalFetch);
      assert.equal(globalThis.WebSocket, originalWebSocket);
      await direct.close();
    }
  `;
  // The CA is trusted only in this test child. Every upstream connection terminates
  // at our local TLS server; no credentials, ChatGPT access or external DNS required.
  const { stdout } = await exec(process.execPath, ["--input-type=module", "-e", script], {
    cwd: new URL("..", import.meta.url), timeout: 15000,
    env: { ...process.env, NODE_EXTRA_CA_CERTS: cert, NO_PROXY: "*", HTTPS_PROXY: "http://127.0.0.1:1" },
  });
  assert.match(stdout, /SSE \+ OAuth URL \+ WSS \+ redirects passed/);
  assert.ok(destinations.some((entry) => entry.host === "chatgpt.com:443"));
  assert.ok(destinations.some((entry) => entry.host === "auth.openai.com:443"));
  assert.ok(destinations.every((entry) => ["chatgpt.com:443", "auth.openai.com:443"].includes(entry.host!)));
  assert.ok(destinations.every((entry) => entry.auth === `Basic ${Buffer.from("fixture:password").toString("base64")}`));
  assert.equal(upgrades.length, 1);
  assert.equal(upgrades[0]["x-test"], "ws-header");
  assert.equal(upgrades[0]["proxy-authorization"], undefined);
  assert.deepEqual(requests.map((request) => request.url), ["/backend-api/codex/responses", "/oauth/token", "/oauth/token", "/redirect"]);
  const request = requests[0];
  const body = request.headers["content-encoding"] === "zstd" ? zlib.zstdDecompressSync(request.body) : request.body;
  assert.equal(JSON.parse(body.toString()).prompt_cache_key, "fixture-session");
  assert.equal(request.headers["chatgpt-account-id"], "fixture-account");
  assert.equal(request.headers["proxy-authorization"], undefined);
});
