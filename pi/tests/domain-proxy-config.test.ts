import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describeDomainProxy, loadDomainProxyConfig, matchesDomain, normalizeProxyUrl } from "../extensions/domain-proxy/config.ts";

function configFile(t: test.TestContext) {
  const dir = mkdtempSync(join(tmpdir(), "pi-domain-proxy-"));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  return join(dir, "domain-proxy.json");
}

test("missing configuration uses explicit defaults without depending on environment proxy settings", (t) => {
  assert.deepEqual(loadDomainProxyConfig(configFile(t)), {
    enabled: true, proxy: "http://127.0.0.1:7890/",
    domains: ["chatgpt.com", "*.chatgpt.com", "auth.openai.com"],
  });
});

test("domains are normalized and configuration edits are read on the next load", (t) => {
  const path = configFile(t);
  writeFileSync(path, JSON.stringify({ proxy: "127.0.0.1:8888", domains: [" ChatGPT.com. ", "*.OPENAI.com", "chatgpt.com"] }));
  assert.deepEqual(loadDomainProxyConfig(path), {
    enabled: true, proxy: "http://127.0.0.1:8888/", domains: ["chatgpt.com", "*.openai.com"],
  });
  writeFileSync(path, '{"enabled":false,"domains":[]}');
  assert.equal(loadDomainProxyConfig(path).enabled, false);
  assert.deepEqual(loadDomainProxyConfig(path).domains, []);
});

for (const [host, domains, expected] of [
  ["chatgpt.com", ["chatgpt.com"], true],
  ["CHATGPT.COM.", ["chatgpt.com"], true],
  ["api.chatgpt.com", ["chatgpt.com"], false],
  ["api.chatgpt.com", ["*.chatgpt.com"], true],
  ["a.b.chatgpt.com", ["*.chatgpt.com"], true],
  ["chatgpt.com", ["*.chatgpt.com"], false],
  ["notchatgpt.com", ["*.chatgpt.com"], false],
  ["chatgpt.com.evil.test", ["chatgpt.com", "*.chatgpt.com"], false],
  ["auth.openai.com", ["*.openai.com"], true],
  ["example.com", [], false],
] as const) {
  test(`domain matching: ${host} against ${domains.join(",")}`, () => {
    assert.equal(matchesDomain(host, domains), expected);
  });
}

for (const config of [null, [], true, { enabled: null }, { enabled: "true" }, { models: ["any"] },
  { domains: "chatgpt.com" }, { domains: [null] }, { domains: [""] }, { domains: ["*"] },
  { domains: ["https://chatgpt.com"] }, { domains: ["chatgpt.com:443"] }, { domains: ["*chatgpt.com"] },
  { domains: ["foo.*.com"] }, { domains: ["foo..com"] }, { domains: ["-foo.com"] },
  { proxy: "" }, { proxy: null }, { proxy: "socks5://127.0.0.1:7890" },
  { proxy: "http://localhost/path" }, { proxy: "http://localhost?token=secret" }, { proxy: "http://localhost:99999" },
]) {
  test(`rejects invalid configuration ${JSON.stringify(config)}`, (t) => {
    const path = configFile(t);
    writeFileSync(path, JSON.stringify(config));
    assert.throws(() => loadDomainProxyConfig(path), /domain-proxy:/);
  });
}

test("bare addresses are HTTP proxies; HTTPS and IPv6 proxies are supported", () => {
  assert.equal(normalizeProxyUrl("127.0.0.1:7890"), "http://127.0.0.1:7890/");
  assert.equal(normalizeProxyUrl("https://localhost:7890"), "https://localhost:7890/");
  assert.equal(normalizeProxyUrl("[::1]:7890"), "http://[::1]:7890/");
});

test("invalid JSON, unreadable paths and status never leak proxy credentials", (t) => {
  const path = configFile(t);
  writeFileSync(path, '{"proxy":"test-secret",');
  assert.throws(() => loadDomainProxyConfig(path), (error: Error) => {
    assert.match(error.message, /invalid JSON/);
    assert.doesNotMatch(error.message, /test-secret/);
    return true;
  });
  assert.throws(() => loadDomainProxyConfig(tmpdir()), /cannot read/);
  writeFileSync(path, JSON.stringify({ proxy: "http://test-user:test-secret@localhost:7890" }));
  const status = describeDomainProxy(loadDomainProxyConfig(path), path);
  assert.match(status, /\*\*\*@localhost:7890/);
  assert.doesNotMatch(status, /test-user|test-secret/);
});
