// Ported from mackt/pi-language-tutor test/core.test.ts (Vitest -> node:test).
// See extensions/translate/ATTRIBUTION.md for provenance.
import assert from "node:assert/strict";
import test from "node:test";
import {
  assistantMessageText,
  buildReviewPrompt,
  buildSegmentPrompt,
  buildWholeTranslatePrompt,
  cardMarkdown,
  CHECK_CONTEXT_PREFACE,
  CONTEXT_PREFACE,
  finalAssistantReplyText,
  isOmpRuntime,
  normalizeStoredConfig,
  parseReviewResult,
  resolveModelReference,
  resolveStoredModelReference,
  segmentMarkdown,
  shouldSkipCheck,
} from "../extensions/translate/src/core.ts";
import {
  getProviderStream,
  getRegisteredProviderStream,
  resolveModel,
  runLlm,
  withProviderAuthBaseUrl,
} from "../extensions/translate/src/llm.ts";
import type {
  ProviderRegistry,
  RegisteredProviderConfigRegistry,
} from "../extensions/translate/src/llm.ts";
import { warnOnCacheMismatch } from "../extensions/translate/src/settings.ts";

test("shouldSkipCheck: inputs that must be skipped", async (t) => {
  await t.test("slash command", () => assert.equal(shouldSkipCheck("/reload"), true));
  await t.test("slash command with args", () =>
    assert.equal(shouldSkipCheck("/model anthropic claude something here"), true));
  await t.test("bang command", () =>
    assert.equal(shouldSkipCheck("!ls -la some directory here"), true));
  await t.test("short reply: yes", () => assert.equal(shouldSkipCheck("yes"), true));
  await t.test("short reply: ok go ahead", () => assert.equal(shouldSkipCheck("ok go ahead"), true));
  await t.test("message containing a code fence", () =>
    assert.equal(
      shouldSkipCheck("please fix this\n```ts\nconst x = 1\n```\nwhat is wrong with it exactly"),
      true,
    ));
  await t.test("mostly code tokens", () =>
    assert.equal(shouldSkipCheck("const x = foo(bar); y->z; a[i] = {b: 1};"), true));
  await t.test("short CJK prompt (<4 chars): skipped", () =>
    assert.equal(shouldSkipCheck("你好吗"), true));
  await t.test("substantial CJK prompt is NOT skipped (reaches the tutor)", () =>
    assert.equal(shouldSkipCheck("请帮我修复这个程序里的错误谢谢"), false));
  await t.test("symbols only", () =>
    assert.equal(shouldSkipCheck("=== !== >>> <<< &&& ||| ??? *** !!!"), true));
});

test("shouldSkipCheck: inputs that must be checked", async (t) => {
  await t.test("one path among prose (1 codey of 5 words = 20%)", () =>
    assert.equal(shouldSkipCheck("look at src/core/extensions/types.ts please"), false));
  await t.test("normal sentence with typos", () =>
    assert.equal(shouldSkipCheck("I want create a extension to leading English"), false));
  await t.test("question mentioning one file", () =>
    assert.equal(
      shouldSkipCheck("why does the loader in loader.ts fail when I reload the extension"),
      false,
    ));
  await t.test("plain 4 words", () => assert.equal(shouldSkipCheck("please explain this error"), false));
});

test("parseReviewResult", async (t) => {
  await t.test("check mode: clean json", () => {
    assert.deepEqual(
      parseReviewResult(
        '{"mode": "check", "items": [{"wrong":"a","right":"b","reason":"c"}], "rephrase": null}',
      ),
      { mode: "check", items: [{ wrong: "a", right: "b", reason: "c" }], rephrase: null },
    );
  });
  await t.test('check mode: tolerates a missing "mode" (backward-compatible shape)', () => {
    assert.deepEqual(parseReviewResult('{"items": [], "rephrase": null}'), {
      mode: "check",
      items: [],
      rephrase: null,
    });
  });
  await t.test("check mode: trims rephrase and drops empty items", () => {
    assert.deepEqual(
      parseReviewResult(
        '{"mode": "check", "items": [{"wrong": "", "right": "", "reason": ""}], "rephrase": "  "}',
      ),
      { mode: "check", items: [], rephrase: null },
    );
  });
  await t.test("tutor mode: parses sentence, words, grammar", () => {
    assert.deepEqual(
      parseReviewResult(
        '{"mode": "tutor", "sentence": "I want to refactor this function.", "words": [{"word": "refactor", "note": "重构"}], "grammar": [{"structure": "want to + infinitive", "note": "表示想要做某事"}]}',
      ),
      {
        mode: "tutor",
        tutor: {
          sentence: "I want to refactor this function.",
          words: [{ word: "refactor", note: "重构" }],
          grammar: [{ structure: "want to + infinitive", note: "表示想要做某事" }],
        },
      },
    );
  });
  await t.test("tutor mode: caps words at 5 and grammar at 3", () => {
    const raw = JSON.stringify({
      mode: "tutor",
      sentence: "x",
      words: Array.from({ length: 8 }, (_, i) => ({ word: `w${i}`, note: "n" })),
      grammar: Array.from({ length: 5 }, (_, i) => ({ structure: `g${i}`, note: "n" })),
    });
    assert.deepEqual(parseReviewResult(raw), {
      mode: "tutor",
      tutor: {
        sentence: "x",
        words: Array.from({ length: 5 }, (_, i) => ({ word: `w${i}`, note: "n" })),
        grammar: Array.from({ length: 3 }, (_, i) => ({ structure: `g${i}`, note: "n" })),
      },
    });
  });
  await t.test("tutor mode with no teachable content degrades to skip", () => {
    assert.deepEqual(
      parseReviewResult('{"mode": "tutor", "sentence": "", "words": [], "grammar": []}'),
      { mode: "skip" },
    );
  });
  await t.test("skip mode", () => assert.deepEqual(parseReviewResult('{"mode": "skip"}'), { mode: "skip" }));
  await t.test('legacy {"skip": true} (old writing-check shape) maps to skip', () => {
    assert.deepEqual(parseReviewResult('{"skip": true}'), { mode: "skip" });
  });
  await t.test("fenced json", () => {
    assert.deepEqual(parseReviewResult('```json\n{"mode": "skip"}\n```'), { mode: "skip" });
  });
  await t.test("json with preamble", () => {
    assert.deepEqual(
      parseReviewResult('Here is the result:\n{"mode": "check", "items": []}'),
      { mode: "check", items: [], rephrase: null },
    );
  });
  await t.test("garbage", () => assert.equal(parseReviewResult("I cannot help with that"), undefined));
  await t.test("non-review JSON (no mode/items/rephrase) is rejected, not treated as a clean check", () => {
    assert.equal(parseReviewResult('{"name": "pkg", "version": "1.0.0"}'), undefined);
  });
  await t.test("mode-less JSON whose items are not review items is rejected too", () => {
    assert.equal(parseReviewResult('{"items": [{"name": "pkg", "version": "1.0.0"}]}'), undefined);
  });
  await t.test("mode-less object with an empty items array still parses as a legacy clean check", () => {
    assert.deepEqual(parseReviewResult('{"items": []}'), { mode: "check", items: [], rephrase: null });
  });
  await t.test("mode-less object with one well-formed item still parses as check", () => {
    assert.deepEqual(parseReviewResult('{"items": [{"wrong":"a","right":"b","reason":"c"}]}'), {
      mode: "check",
      items: [{ wrong: "a", right: "b", reason: "c" }],
      rephrase: null,
    });
  });
  await t.test("mode-less object with only rephrase still parses as check", () => {
    assert.deepEqual(parseReviewResult('{"rephrase": "Better phrasing."}'), {
      mode: "check",
      items: [],
      rephrase: "Better phrasing.",
    });
  });
  await t.test("truncated json", () => {
    assert.equal(parseReviewResult('{"mode": "check", "items": [{"wrong": "a"'), undefined);
  });
});

test("segmentMarkdown", async (t) => {
  const md = `First, register the handler:

\`\`\`ts
pi.on("x", () => {});
\`\`\`

Then run it. It works.

\`\`\`sh
line1
line2
line3
line4
line5
line6
line7
\`\`\`

Done.`;

  await t.test("alternates prose and code segments", () => {
    assert.deepEqual(
      segmentMarkdown(md).map((s) => s.kind),
      ["prose", "code", "prose", "code", "prose"],
    );
  });
  await t.test("counts code lines per block", () => {
    assert.deepEqual(
      segmentMarkdown(md)
        .filter((s) => s.kind === "code")
        .map((s) => (s as { lines: number }).lines),
      [1, 7],
    );
  });
  await t.test("extracts prose texts", () => {
    assert.deepEqual(
      segmentMarkdown(md)
        .filter((s) => s.kind === "prose")
        .map((s) => (s as { text: string }).text),
      ["First, register the handler:", "Then run it. It works.", "Done."],
    );
  });
  await t.test("no code blocks", () => {
    assert.deepEqual(segmentMarkdown("Just one paragraph.\n\nAnd another."), [
      { kind: "prose", text: "Just one paragraph." },
      { kind: "prose", text: "And another." },
    ]);
  });
  await t.test("unclosed fence still yields a code segment", () => {
    assert.deepEqual(segmentMarkdown("intro\n\n```\ncode").map((s) => s.kind), ["prose", "code"]);
  });
  await t.test("empty input", () => assert.deepEqual(segmentMarkdown(""), []));
});

test("cardMarkdown", () => {
  const card = cardMarkdown([
    { kind: "pair", src: "Hello world.", dst: "你好世界。" },
    { kind: "code", text: "```ts\nx()\n```" },
    { kind: "codeRef", lines: 23 },
  ]);
  assert.match(card, /Hello world\.\n\n> 你好世界。/);
  assert.match(card, /```ts\nx\(\)\n```/);
  assert.match(card, /\*\[code block ↑ 23 lines\]\*/);
});

test("assistantMessageText", async (t) => {
  await t.test("joins text segments and trims", () => {
    const message = {
      role: "assistant",
      content: [
        { type: "thinking", thinking: "hmm" },
        { type: "text", text: "  Hello " },
        { type: "text", text: "world.\n" },
      ],
    };
    assert.equal(assistantMessageText(message), "Hello \nworld.");
  });

  await t.test("ignores non-assistant messages", () => {
    assert.equal(
      assistantMessageText({ role: "user", content: [{ type: "text", text: "hi" }] }),
      undefined,
    );
    assert.equal(
      assistantMessageText({ role: "toolResult", content: [{ type: "text", text: "ok" }] }),
      undefined,
    );
  });

  await t.test("returns undefined for malformed or empty messages", () => {
    assert.equal(assistantMessageText(undefined), undefined);
    assert.equal(assistantMessageText(null), undefined);
    assert.equal(assistantMessageText("text"), undefined);
    assert.equal(assistantMessageText({ role: "assistant" }), undefined);
    assert.equal(assistantMessageText({ role: "assistant", content: "plain string" }), undefined);
    assert.equal(assistantMessageText({ role: "assistant", content: [] }), undefined);
    assert.equal(
      assistantMessageText({ role: "assistant", content: [{ type: "text", text: "  " }] }),
      undefined,
    );
    assert.equal(
      assistantMessageText({ role: "assistant", content: [{ type: "text", text: 42 }, null] }),
      undefined,
    );
  });

  await t.test("still extracts text from a tool-call turn", () => {
    const message = {
      role: "assistant",
      stopReason: "toolUse",
      content: [
        { type: "text", text: "Let me look." },
        { type: "toolCall", id: "1", name: "read", arguments: {} },
      ],
    };
    assert.equal(assistantMessageText(message), "Let me look.");
  });
});

test("finalAssistantReplyText", async (t) => {
  await t.test("returns the text of a final reply", () => {
    const message = { role: "assistant", stopReason: "stop", content: [{ type: "text", text: "All done." }] };
    assert.equal(finalAssistantReplyText(message), "All done.");
  });

  await t.test("accepts messages without a stopReason", () => {
    assert.equal(
      finalAssistantReplyText({ role: "assistant", content: [{ type: "text", text: "Done." }] }),
      "Done.",
    );
  });

  await t.test("skips intermediate turns that continue with tool calls", () => {
    assert.equal(
      finalAssistantReplyText({
        role: "assistant",
        stopReason: "toolUse",
        content: [{ type: "text", text: "Let me check that file for you first." }],
      }),
      undefined,
    );
    assert.equal(
      finalAssistantReplyText({
        role: "assistant",
        content: [
          { type: "text", text: "Let me check that file for you first." },
          { type: "toolCall", id: "1", name: "read", arguments: {} },
        ],
      }),
      undefined,
    );
  });

  await t.test("returns undefined for non-assistant or malformed input", () => {
    assert.equal(
      finalAssistantReplyText({ role: "user", content: [{ type: "text", text: "hi" }] }),
      undefined,
    );
    assert.equal(finalAssistantReplyText(undefined), undefined);
  });
});

test("buildReviewPrompt", async (t) => {
  const cfg = { learning: "en", native: "zh-CN", check: "on" as const, auto: false, context: false, tutor: true };
  const prompt = buildReviewPrompt("some prompt", cfg);

  await t.test("mentions both modes and the learning language", () => {
    assert.match(prompt, /mode "check"/);
    assert.match(prompt, /mode "tutor"/);
    assert.match(prompt, /\{"mode": "skip"\}/);
    assert.match(prompt, new RegExp(cfg.learning));
  });
  await t.test("wraps the message in <<< >>> delimiters", () => {
    assert.match(prompt, /<<<\nsome prompt\n>>>/);
  });
  await t.test("asks the tutor to teach words, grammar, and the whole sentence in the native language", () => {
    assert.match(prompt, /"sentence"/);
    assert.match(prompt, /"words"/);
    assert.match(prompt, /"grammar"/);
    assert.match(prompt, new RegExp(cfg.native));
  });

  await t.test("with tutor off", async (t2) => {
    const offPrompt = buildReviewPrompt("some prompt", { ...cfg, tutor: false });
    await t2.test("withholds tutor mode entirely", () => {
      assert.doesNotMatch(offPrompt, /mode "tutor"/);
      assert.doesNotMatch(offPrompt, /"sentence"/);
      assert.doesNotMatch(offPrompt, /"words"/);
    });
    await t2.test("routes non-learning-language messages to skip instead", () => {
      assert.match(offPrompt, new RegExp(`NOT primarily written in ${cfg.learning}`));
      assert.match(offPrompt, /\{"mode": "skip"\}/);
    });
    await t2.test("keeps the check mode intact", () => {
      assert.match(offPrompt, /mode "check"/);
      assert.match(offPrompt, /"rephrase"/);
      assert.match(offPrompt, /<<<\nsome prompt\n>>>/);
    });
  });
});

test("prompt builders", async (t) => {
  const cfg = { learning: "en", native: "zh-CN", check: "on" as const, auto: false, context: false, tutor: true };

  await t.test("review prompt has no context preface by default", () => {
    assert.doesNotMatch(buildReviewPrompt("some text", cfg), new RegExp(escapeRegExp(CHECK_CONTEXT_PREFACE)));
  });
  await t.test("contextual review prompt starts with the check preface", () => {
    assert.equal(buildReviewPrompt("some text", cfg, true).startsWith(CHECK_CONTEXT_PREFACE), true);
  });
  await t.test("segment prompt numbers segments and pins the count", () => {
    const sp = buildSegmentPrompt(["a", "b"], cfg);
    assert.match(sp, /\[0\]\na/);
    assert.match(sp, /\[1\]\nb/);
    assert.match(sp, /exactly 2 strings/);
  });
  await t.test("segment prompt has no context preface by default", () => {
    assert.doesNotMatch(buildSegmentPrompt(["a", "b"], cfg), new RegExp(escapeRegExp(CONTEXT_PREFACE)));
  });
  await t.test("contextual segment prompt starts with the preface", () => {
    assert.equal(buildSegmentPrompt(["a"], cfg, true).startsWith(CONTEXT_PREFACE), true);
  });
  await t.test("whole-translate prompt wraps the source text", () => {
    assert.match(buildWholeTranslatePrompt("some text", cfg), /<<<\nsome text\n>>>/);
  });
  await t.test("contextual whole-translate prompt starts with the preface", () => {
    assert.equal(buildWholeTranslatePrompt("x", cfg, true).startsWith(CONTEXT_PREFACE), true);
  });
});

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const registry = (provider: ReturnType<ProviderRegistry["getProvider"]>): ProviderRegistry => ({
  getProvider: () => provider,
});
const legacyRegistry = (
  config: ReturnType<RegisteredProviderConfigRegistry["getRegisteredProviderConfig"]>,
): RegisteredProviderConfigRegistry => ({ getRegisteredProviderConfig: () => config });

test("getProviderStream (composed-provider side-calls)", async (t) => {
  await t.test("routes through the composed provider streamSimple", () => {
    const calls: unknown[][] = [];
    const provider = {
      streamSimple: ((...args: unknown[]) => {
        calls.push(args);
        return { result: async () => ({}) };
      }) as never,
    };
    const stream = getProviderStream(registry(provider), { provider: "cursor" });
    assert.equal(typeof stream, "function");
    stream!("model" as never, "context" as never, "options" as never);
    assert.deepEqual(calls, [["model", "context", "options"]]);
  });
  await t.test("preserves the provider as receiver of streamSimple", () => {
    let calledOnProvider = false;
    const provider = {
      streamSimple: function (this: unknown) {
        calledOnProvider = this === provider;
        return { result: async () => ({}) };
      } as never,
    };
    getProviderStream(registry(provider), { provider: "cursor" })!("m" as never, "c" as never);
    assert.equal(calledOnProvider, true);
  });
  await t.test("falls back when the provider is unknown", () => {
    assert.equal(getProviderStream(registry(undefined), { provider: "cursor" }), undefined);
  });
  await t.test("falls back when the provider lacks streamSimple", () => {
    assert.equal(getProviderStream(registry({}), { provider: "zai" }), undefined);
  });
});

test("getRegisteredProviderStream (pi 0.80 config-provider fallback)", async (t) => {
  const fakeStream = (() => ({ result: async () => ({}) })) as never;

  await t.test("uses the registered streamSimple when the api matches", () => {
    assert.equal(
      typeof getRegisteredProviderStream(legacyRegistry({ api: "cursor-sdk", streamSimple: fakeStream }), {
        provider: "cursor",
        api: "cursor-sdk",
      }),
      "function",
    );
  });
  await t.test("ignores streamSimple when the api mismatches", () => {
    assert.equal(
      getRegisteredProviderStream(legacyRegistry({ api: "cursor-sdk", streamSimple: fakeStream }), {
        provider: "cursor",
        api: "openai-completions",
      }),
      undefined,
    );
  });
  await t.test("falls back when the provider has no streamSimple", () => {
    assert.equal(
      getRegisteredProviderStream(legacyRegistry({ api: "openai-completions" }), {
        provider: "zai",
        api: "openai-completions",
      }),
      undefined,
    );
  });
  await t.test("falls back when the provider config is undefined", () => {
    assert.equal(
      getRegisteredProviderStream(legacyRegistry(undefined), { provider: "cursor", api: "cursor-sdk" }),
      undefined,
    );
  });
});

test("runLlm auth handling: allows configured keyless providers to reach streamSimple", async () => {
  let seenApiKey: string | undefined | "not-called" = "not-called";
  const model = { provider: "local", id: "model", api: "local-api" };
  const ctx = {
    modelRegistry: {
      getApiKeyAndHeaders: async () => ({ ok: true }),
      getProvider: () => ({
        streamSimple: (_model: unknown, _context: unknown, options?: { apiKey?: string }) => {
          seenApiKey = options?.apiKey;
          return { result: async () => ({ stopReason: "stop", content: [{ type: "text", text: "ok" }] }) };
        },
      }),
    },
  } as never;

  assert.equal(await runLlm(ctx, model as never, "translate this"), "ok");
  assert.equal(seenApiKey, undefined);
});

test("withProviderAuthBaseUrl", async (t) => {
  await t.test("copies request-scoped provider auth baseUrl onto the model", async () => {
    const model = { provider: "copilot", baseUrl: "https://default.example" };
    assert.deepEqual(
      await withProviderAuthBaseUrl(
        { getProviderAuth: async () => ({ auth: { baseUrl: "https://request.example" } }) },
        model,
      ),
      { provider: "copilot", baseUrl: "https://request.example" },
    );
  });
  await t.test("keeps the model unchanged when provider auth has no baseUrl", async () => {
    const model = { provider: "anthropic", baseUrl: "https://api.anthropic.com" };
    assert.equal(await withProviderAuthBaseUrl({ getProviderAuth: async () => ({ auth: {} }) }, model), model);
  });
  await t.test("keeps the model unchanged when the registry cannot resolve provider auth", async () => {
    const model = { provider: "anthropic", baseUrl: "https://api.anthropic.com" };
    assert.equal(await withProviderAuthBaseUrl({}, model), model);
  });
});

test("resolveModelReference (pi CLI -m semantics)", async (t) => {
  const zai = { provider: "zai", id: "glm-5" };
  const gateway = { provider: "gateway", id: "zai/glm-5" };
  const openai = { provider: "openai", id: "gpt-4o-mini" };
  const azure = { provider: "azure", id: "gpt-4o-mini" };
  const catalog = [zai, gateway, openai, azure];

  await t.test("prefers the provider interpretation over a raw-id lookalike", () => {
    assert.deepEqual(resolveModelReference("zai/glm-5", catalog, catalog), { kind: "found", model: zai });
  });
  await t.test("canonical ref reaches a model whose id contains a slash", () => {
    assert.deepEqual(resolveModelReference("gateway/zai/glm-5", catalog, catalog), {
      kind: "found",
      model: gateway,
    });
  });
  await t.test("auth-aware tiebreak: unauthed provider ref falls to the unique authed raw id", () => {
    assert.deepEqual(resolveModelReference("zai/glm-5", [gateway], catalog), { kind: "found", model: gateway });
  });
  await t.test("needsAuth when the provider ref has no authed raw-id lookalike", () => {
    assert.deepEqual(resolveModelReference("openai/gpt-4o-mini", [azure], catalog), {
      kind: "needsAuth",
      model: openai,
    });
  });
  await t.test("known provider without that model still matches the whole ref as a raw id", () => {
    const zaiOther = { provider: "zai", id: "glm-4" };
    assert.deepEqual(resolveModelReference("zai/glm-5", [gateway, zaiOther], [gateway, zaiOther]), {
      kind: "found",
      model: gateway,
    });
  });
  await t.test("resolves a unique bare id among configured-auth models", () => {
    assert.deepEqual(resolveModelReference("glm-5", [zai, openai], catalog), { kind: "found", model: zai });
  });
  await t.test("reports an ambiguous bare id with its candidates", () => {
    assert.deepEqual(resolveModelReference("gpt-4o-mini", catalog, catalog), {
      kind: "ambiguous",
      candidates: [openai, azure],
    });
  });
  await t.test("bare id known only to unconfigured catalogs reports noAuthAnywhere", () => {
    assert.deepEqual(resolveModelReference("gpt-4o-mini", [], catalog), {
      kind: "noAuthAnywhere",
      candidates: [openai, azure],
    });
  });
  await t.test("matches case-insensitively", () => {
    assert.equal(resolveModelReference("ZAI/GLM-5", catalog, catalog).kind, "found");
  });
  await t.test("unknown reference", () => {
    assert.deepEqual(resolveModelReference("gpt-nonexistent", catalog, catalog), { kind: "none" });
  });
  await t.test("empty reference", () => {
    assert.deepEqual(resolveModelReference("  ", catalog, catalog), { kind: "none" });
  });
});

const lang = (model?: string, context = false) => ({
  learning: "en",
  native: "zh-CN",
  model,
  check: "on" as const,
  auto: false,
  context,
  tutor: true,
});

test("normalizeStoredConfig", async (t) => {
  await t.test("defaults to check on", () => assert.equal(normalizeStoredConfig({}).check, "on"));
  await t.test("migrates legacy enabled: false to check off", () =>
    assert.equal(normalizeStoredConfig({ enabled: false }).check, "off"));
  await t.test("migrates legacy enabled: true to check on", () =>
    assert.equal(normalizeStoredConfig({ enabled: true }).check, "on"));
  await t.test("keeps an explicit tri-state check value", () =>
    assert.equal(normalizeStoredConfig({ check: "context" }).check, "context"));
  await t.test("an explicit check value wins over a stale legacy enabled flag", () =>
    assert.equal(normalizeStoredConfig({ check: "context", enabled: false }).check, "context"));
  await t.test("rejects an invalid check value back to the default", () =>
    assert.equal(normalizeStoredConfig({ check: "sometimes" as never }).check, "on"));
  await t.test("defaults tutor to on and keeps an explicit tutor: false", () => {
    assert.equal(normalizeStoredConfig({}).tutor, true);
    assert.equal(normalizeStoredConfig({ tutor: false }).tutor, false);
  });
});

test("resolveModel (pi CLI semantics over available/catalog)", async (t) => {
  const openai = { provider: "openai", id: "gpt-4o-mini" };
  const azure = { provider: "azure", id: "gpt-4o-mini" };
  const cloudflare = { provider: "cloudflare", id: "gpt-4o-mini" };
  const session = { provider: "anthropic", id: "claude-sonnet-5" };
  const catalog = [openai, azure, cloudflare, session];
  const ctx = (available: unknown[]) =>
    ({ modelRegistry: { getAvailable: () => available, getAll: () => catalog }, model: session }) as never;

  await t.test("resolves a bare id against configured-auth models even when other catalogs list it", () => {
    assert.equal(resolveModel(ctx([openai, session]), lang("gpt-4o-mini") as never), openai);
  });
  await t.test("an override that lost auth still resolves from the catalog (fails visibly later)", () => {
    assert.equal(resolveModel(ctx([session]), lang("openai/gpt-4o-mini") as never), openai);
  });
  await t.test("a bare id ambiguous among available models falls back to the session model", () => {
    assert.equal(resolveModel(ctx([openai, azure, session]), lang("gpt-4o-mini") as never), session);
  });
  await t.test("an unknown override falls back to the session model", () => {
    assert.equal(resolveModel(ctx([session]), lang("gpt-nonexistent") as never), session);
  });
  await t.test("no override uses the session model", () => {
    assert.equal(resolveModel(ctx([session]), lang(undefined) as never), session);
  });
});

test("warnOnCacheMismatch", async (t) => {
  const session = { provider: "openai", id: "gpt-4o-mini" };
  const other = { provider: "zai", id: "glm-5" };
  const azureDup = { provider: "azure", id: "gpt-4o-mini" };
  const ctx = (notes: string[], available = [session, other], all = [session, other]) =>
    ({
      model: session,
      modelRegistry: { getAvailable: () => available, getAll: () => all },
      ui: {
        notify: (msg: string) => {
          notes.push(msg);
        },
      },
    }) as never;

  await t.test("does not warn when a hand-edited ref resolves to the session model", () => {
    const notes: string[] = [];
    warnOnCacheMismatch(ctx(notes), lang("GPT-4O-MINI", true) as never);
    assert.deepEqual(notes, []);
  });
  await t.test("warns when the override resolves to a different model", () => {
    const notes: string[] = [];
    warnOnCacheMismatch(ctx(notes), lang("glm-5", true) as never);
    assert.equal(notes.length, 1);
    assert.match(notes[0], /zai\/glm-5/);
  });
  await t.test("stays quiet while context mode is off", () => {
    const notes: string[] = [];
    warnOnCacheMismatch(ctx(notes), lang("glm-5", false) as never);
    assert.deepEqual(notes, []);
  });
  await t.test(
    "uses the same available/catalog resolution as runLlm: an unauthed catalog duplicate does not fake a mismatch",
    () => {
      const notes: string[] = [];
      warnOnCacheMismatch(ctx(notes, [session, other], [session, other, azureDup]), lang("gpt-4o-mini", true) as never);
      assert.deepEqual(notes, []);
    },
  );
  await t.test("names translations when only translation context is on", () => {
    const notes: string[] = [];
    warnOnCacheMismatch(ctx(notes), lang("glm-5", true) as never);
    assert.match(notes[0], /context-mode translations/);
    assert.doesNotMatch(notes[0], /writing checks/);
  });
  await t.test("names writing checks when only check context is on", () => {
    const notes: string[] = [];
    warnOnCacheMismatch(ctx(notes), { ...lang("glm-5", false), check: "context" } as never);
    assert.match(notes[0], /context-mode writing checks/);
    assert.doesNotMatch(notes[0], /translations/);
  });
  await t.test("names both when translation and check context are on", () => {
    const notes: string[] = [];
    warnOnCacheMismatch(ctx(notes), { ...lang("glm-5", true), check: "context" } as never);
    assert.match(notes[0], /translations and writing checks/);
  });
});

test("resolveStoredModelReference (saved config refs)", async (t) => {
  const openai = { provider: "openai", id: "gpt-4o-mini" };
  const openrouter = { provider: "openrouter", id: "openai/gpt-4o-mini" };
  const catalog = [openai, openrouter];

  await t.test("restores a saved canonical ref exactly, as needsAuth when its provider lost auth", () => {
    assert.deepEqual(resolveStoredModelReference("openai/gpt-4o-mini", [openrouter], catalog), {
      kind: "needsAuth",
      model: openai,
    });
  });
  await t.test("returns found when the saved canonical ref still has auth", () => {
    assert.deepEqual(resolveStoredModelReference("openai/gpt-4o-mini", [openai], catalog), {
      kind: "found",
      model: openai,
    });
  });
  await t.test("falls back to interactive semantics for a hand-edited bare id", () => {
    assert.deepEqual(resolveStoredModelReference("gpt-4o-mini", [openai], catalog), {
      kind: "found",
      model: openai,
    });
  });
  await t.test("a saved provider ref whose model left the catalog is not raw-matched onto a lookalike", () => {
    const openaiOther = { provider: "openai", id: "gpt-4o" };
    assert.deepEqual(
      resolveStoredModelReference("openai/gpt-4o-mini", [openrouter], [openaiOther, openrouter]),
      { kind: "none" },
    );
  });
  await t.test("a raw id whose prefix names no provider still resolves interactively", () => {
    const orphan = { provider: "openrouter", id: "mistral/devstral" };
    assert.deepEqual(resolveStoredModelReference("mistral/devstral", [orphan], [orphan]), {
      kind: "found",
      model: orphan,
    });
  });
});

test("slash-containing refs follow pi CLI semantics (OpenRouter-style ids)", async (t) => {
  const openai = { provider: "openai", id: "gpt-4o-mini" };
  const openrouter = { provider: "openrouter", id: "openai/gpt-4o-mini" };
  const session = { provider: "anthropic", id: "claude-sonnet-5" };
  const catalog = [openai, openrouter, session];
  const ctx = (available: unknown[]) =>
    ({ modelRegistry: { getAvailable: () => available, getAll: () => catalog }, model: session }) as never;

  await t.test("a saved canonical override is restored exactly even when an authed raw-id lookalike exists", () => {
    assert.equal(resolveModel(ctx([openrouter, session]), lang("openai/gpt-4o-mini") as never), openai);
  });
  await t.test("the openrouter model stays reachable through its canonical ref", () => {
    assert.equal(resolveModel(ctx([openrouter, session]), lang("openrouter/openai/gpt-4o-mini") as never), openrouter);
  });
  await t.test("a slash-containing reference matching no catalog provider still resolves as a bare id", () => {
    const orphan = { provider: "openrouter", id: "mistral/devstral" };
    const orphanCtx = {
      modelRegistry: { getAvailable: () => [orphan, session], getAll: () => [orphan, session] },
      model: session,
    } as never;
    assert.equal(resolveModel(orphanCtx, lang("mistral/devstral") as never), orphan);
  });
  await t.test("a bare id that lost auth everywhere still resolves from the catalog (fails visibly later)", () => {
    assert.equal(resolveModel(ctx([session]), lang("gpt-4o-mini") as never), openai);
  });
});

const fn = () => {};

test("isOmpRuntime", async (t) => {
  await t.test("detects omp: message renderer without entry renderer", () => {
    assert.equal(isOmpRuntime({ registerMessageRenderer: fn }), true);
  });
  await t.test("treats pi 1.0 with both renderer APIs as pi", () => {
    assert.equal(isOmpRuntime({ registerMessageRenderer: fn, registerEntryRenderer: fn }), false);
  });
  await t.test("treats pi 0.8x with only the entry renderer as pi", () => {
    assert.equal(isOmpRuntime({ registerEntryRenderer: fn }), false);
  });
  await t.test("does not mistake a runtime with neither API for omp", () => {
    assert.equal(isOmpRuntime({}), false);
  });
});
