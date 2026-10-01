import assert from "node:assert/strict";
import test from "node:test";
import mermaidExtension from "../extensions/mermaid/index.ts";
import { createExtensionHarness } from "./helpers/extension.ts";

const FLOWCHART = `\`\`\`mermaid
flowchart LR
  A[Start] --> B[Done]
\`\`\``;

function renderedMessages(harness: ReturnType<typeof createExtensionHarness>) {
  return harness.sent.filter(({ message }) => message.customType === "mermaid");
}

test("mermaid extension renders fenced input and keeps a local message renderer", async () => {
  const harness = createExtensionHarness(mermaidExtension);

  const result = await harness.emit("input", { source: "user", text: FLOWCHART });

  assert.equal(result[0].action, "continue");
  assert.equal(harness.renderers.has("mermaid"), true);
  assert.equal(renderedMessages(harness).length, 1);
  const message = renderedMessages(harness)[0].message;
  assert.match(message.details.ascii, /Start/);
  assert.match(message.details.ascii, /Done/);
  assert.match(message.details.source, /flowchart LR/);
  assert.deepEqual(harness.notices, []);

  const renderer = harness.renderers.get("mermaid");
  const theme = {
    fg: (_color: string, text: string) => text,
    bg: (_color: string, text: string) => text,
    bold: (text: string) => text,
  };
  const output = renderer(message, { expanded: false }, theme).render(30);
  assert.match(output.join("\n"), /Mermaid \(ASCII\)/);
  assert.ok(output.every((line: string) => line.length <= 30));
});

test("mermaid extension renders assistant output and ignores extension input", async () => {
  const harness = createExtensionHarness(mermaidExtension);

  await harness.emit("input", { source: "extension", text: FLOWCHART });
  assert.equal(renderedMessages(harness).length, 0);

  await harness.emit("agent_end", {
    messages: [{ role: "assistant", content: [{ type: "text", text: FLOWCHART }] }],
  });
  assert.equal(renderedMessages(harness).length, 1);
});

test("pi-mermaid command renders the last assistant diagram", async () => {
  const harness = createExtensionHarness(mermaidExtension);
  harness.entries.push(
    { type: "message", message: { role: "assistant", content: "No diagram here" } },
    { type: "message", message: { role: "assistant", content: FLOWCHART } },
  );

  await harness.command("pi-mermaid");

  assert.equal(renderedMessages(harness).length, 1);
  assert.match(renderedMessages(harness)[0].message.details.ascii, /Start/);
});

test("mermaid extension reports parse failures in the UI and model context", async () => {
  const harness = createExtensionHarness(mermaidExtension);

  await harness.emit("input", {
    source: "user",
    text: "```mermaid\nflowchart LR\n  A --\n```",
  });

  const message = renderedMessages(harness)[0].message;
  assert.equal(message.details.ascii, "[parse failed]");
  assert.match(message.content, /^\[mermaid:error\]\[hash:[a-f0-9]{8}\] Mermaid parse error/);
  assert.match(harness.notices.at(-1) ?? "", /Mermaid parse error/);
});

test("mermaid extension reports unsupported diagram types without sending a message", async () => {
  const harness = createExtensionHarness(mermaidExtension);

  await harness.emit("input", {
    source: "user",
    text: "```mermaid\ngantt\n  title Release\n```",
  });

  assert.equal(renderedMessages(harness).length, 0);
  assert.match(harness.notices.at(-1) ?? "", /can't render type "gantt"/);
});
