import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import type { ExtensionAPI, ExtensionCommandContext } from "@earendil-works/pi-coding-agent";
import domainProxy from "../extensions/domain-proxy/index.ts";

test("extension has no provider registration and exposes status plus cleanup", async (t) => {
  const dir = mkdtempSync(join(tmpdir(), "pi-domain-extension-"));
  const previousDir = process.env.PI_CODING_AGENT_DIR;
  const previousFetch = globalThis.fetch;
  const previousWebSocket = globalThis.WebSocket;
  process.env.PI_CODING_AGENT_DIR = dir;
  let shutdown: (() => Promise<void>) | undefined;
  let command: Parameters<ExtensionAPI["registerCommand"]>[1] | undefined;
  t.after(async () => {
    await shutdown?.();
    if (previousDir === undefined) delete process.env.PI_CODING_AGENT_DIR;
    else process.env.PI_CODING_AGENT_DIR = previousDir;
    rmSync(dir, { recursive: true, force: true });
  });
  domainProxy({
    registerProvider() { throw new Error("must not replace providers"); },
    on(event: string, handler: () => Promise<void>) { assert.equal(event, "session_shutdown"); shutdown = handler; },
    registerCommand(name: string, value: Parameters<ExtensionAPI["registerCommand"]>[1]) {
      assert.equal(name, "domain-proxy"); command = value;
    },
  } as unknown as ExtensionAPI);
  assert.ok(shutdown);
  assert.ok(command);
  const messages: { text: string; level: string }[] = [];
  const ctx = { ui: { notify(text: string, level: string) { messages.push({ text, level }); } } } as unknown as ExtensionCommandContext;
  await command.handler("", ctx);
  assert.match(messages[0].text, /chatgpt\.com/);
  assert.ok(messages[0].text.includes(join(dir, "domain-proxy.json")));
  writeFileSync(join(dir, "domain-proxy.json"), '{"enabled":false}');
  await command.handler("", ctx);
  assert.match(messages[1].text, /disabled/);
  writeFileSync(join(dir, "domain-proxy.json"), "{");
  await command.handler("", ctx);
  assert.equal(messages[2].level, "error");
  await shutdown();
  assert.equal(globalThis.fetch, previousFetch);
  assert.equal(globalThis.WebSocket, previousWebSocket);
});
