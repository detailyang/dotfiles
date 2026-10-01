import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { loadDomainProxyConfig } from "../extensions/domain-proxy/config.ts";

test("proxy configuration selects domains, not models", (t) => {
  const dir = mkdtempSync(join(tmpdir(), "pi-domain-proxy-red-"));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const path = join(dir, "domain-proxy.json");
  writeFileSync(path, JSON.stringify({ proxy: "127.0.0.1:7890", domains: ["chatgpt.com", "*.openai.com"] }));
  const config = loadDomainProxyConfig(path);
  assert.equal("models" in config, false);
  assert.deepEqual((config as unknown as { domains: string[] }).domains, ["chatgpt.com", "*.openai.com"]);
});
