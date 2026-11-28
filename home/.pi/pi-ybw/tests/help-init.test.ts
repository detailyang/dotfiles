import assert from "node:assert/strict";
import test from "node:test";
import helpExtension from "../extensions/help/index.ts";
import initExtension from "../extensions/init/index.ts";

test("help command lists thinking and trust built-ins and omits unsupported filter hint", async () => {
  let command: any;
  let renderedLines: string[] = [];
  const pi = {
    getCommands: () => [{ name: "goal", description: "Manage goals", source: "extension" }],
    registerCommand(name: string, registered: any) {
      assert.equal(name, "help");
      command = registered;
    },
  };
  helpExtension(pi as never);
  assert.ok(command);

  const theme = {
    fg: (_c: string, s: string) => s,
    bold: (s: string) => s,
  };
  await command.handler("", {
    mode: "tui",
    ui: {
      notify() {},
      async custom(factory: any) {
        const component = factory({ requestRender() {} }, theme, {}, () => {});
        renderedLines = component.render(100);
      },
    },
  });

  const text = renderedLines.join("\n");
  assert.match(text, /\/thinking\b/);
  assert.match(text, /\/trust\b/);
  assert.doesNotMatch(text, /\/ filter/);
});

test("init command queues followUp when session is busy", async () => {
  let command: any;
  const sent: Array<{ text: string; options: unknown }> = [];
  initExtension({
    registerCommand(name: string, registered: any) {
      assert.equal(name, "init");
      command = registered;
    },
    sendUserMessage(text: string, options?: unknown) {
      sent.push({ text, options });
    },
  } as never);
  assert.ok(command);

  await command.handler("", { isIdle: () => true });
  await command.handler("", { isIdle: () => false });

  assert.equal(sent.length, 2);
  assert.equal(sent[0].options, undefined);
  assert.deepEqual(sent[1].options, { deliverAs: "followUp" });
});

test("init command instructs the agent to create a missing AGENTS.md", async () => {
  let command: any;
  const sent: string[] = [];
  initExtension({
    registerCommand(name: string, registered: any) {
      assert.equal(name, "init");
      command = registered;
    },
    sendUserMessage(text: string) {
      sent.push(text);
    },
  } as never);
  assert.ok(command);

  await command.handler("", { isIdle: () => true });

  assert.equal(sent.length, 1);
  assert.match(sent[0], /If no AGENTS\.md exists, create one/);
});
