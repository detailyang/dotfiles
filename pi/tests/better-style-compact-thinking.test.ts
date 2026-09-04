import assert from "node:assert/strict";
import test from "node:test";
import type { AssistantMessage } from "@earendil-works/pi-ai";
import { AssistantMessageComponent, initTheme } from "@earendil-works/pi-coding-agent";
import {
  clearThinkingPreviewCache,
  installCompactThinking,
  ThinkingPreviewBlock,
} from "../extensions/better-style/feature/compact-thinking.ts";

initTheme("dark");

function runtime() {
  const handlers = new Map<string, Function[]>();
  return {
    pi: {
      on(name: string, handler: Function) {
        const list = handlers.get(name) ?? [];
        list.push(handler);
        handlers.set(name, list);
      },
    } as any,
    emit(name: string, event: any = {}, ctx: any = {}) {
      for (const handler of handlers.get(name) ?? []) handler(event, ctx);
    },
  };
}

function tuiContext(roots: unknown[] = []) {
  const tui = {
    getMountedRoots: () => roots,
    requestRender() {},
  };
  return {
    mode: "tui",
    sessionManager: { getBranch: () => [], getEntries: () => [] },
    ui: {
      theme: {
        fg: (_color: string, text: string) => text,
        italic: (text: string) => text,
        bold: (text: string) => text,
      },
      setWidget(_id: string, factory: Function | undefined) {
        factory?.(tui);
      },
      requestRender() {},
    },
  } as any;
}

const headlessContext = {
  mode: "print",
  hasUI: false,
  sessionManager: { getBranch: () => [], getEntries: () => [] },
  ui: { theme: {}, setWidget() {}, requestRender() {} },
};

function renderText(component: any, width = 120): string[] {
  return component
    .render(width)
    .map((line: string) =>
      line
        .replace(/\x1b\[[0-?]*[ -/]*[@-~]/g, "")
        .replace(/\x1b\][^\x07]*\x07/g, "")
        .trim(),
    )
    .filter(Boolean);
}

function thinkingMessage(timestamp: number, toolName?: string): AssistantMessage {
  return {
    role: "assistant",
    timestamp,
    content: [
      { type: "thinking", thinking: "plan the next step" },
      ...(toolName
        ? [{ type: "toolCall", id: "tool-1", name: toolName, arguments: {} }]
        : []),
    ],
  } as unknown as AssistantMessage;
}

test("compact thinking installs lazily and restores the prototype on shutdown", () => {
  const original = AssistantMessageComponent.prototype.updateContent;
  const { pi, emit } = runtime();
  const ctx = tuiContext();

  installCompactThinking(pi, {
    useSummaryTitlesAsThinkingTitle: false,
    previewLines: 3,
  });
  assert.equal(AssistantMessageComponent.prototype.updateContent, original);

  emit("session_start", {}, ctx);
  assert.notEqual(AssistantMessageComponent.prototype.updateContent, original);

  emit("session_shutdown", {}, ctx);
  assert.equal(AssistantMessageComponent.prototype.updateContent, original);
});

test("a headless runtime cannot steal or remove the parent TUI patch", () => {
  const original = AssistantMessageComponent.prototype.updateContent;
  const parent = runtime();
  const nested = runtime();
  const ctx = tuiContext();

  installCompactThinking(parent.pi, {
    useSummaryTitlesAsThinkingTitle: false,
    previewLines: 3,
  });
  parent.emit("session_start", {}, ctx);
  const parentPatch = AssistantMessageComponent.prototype.updateContent;

  installCompactThinking(nested.pi, {
    useSummaryTitlesAsThinkingTitle: false,
    previewLines: 3,
  });
  nested.emit("session_start", {}, headlessContext);
  nested.emit("session_shutdown", {}, headlessContext);
  assert.equal(AssistantMessageComponent.prototype.updateContent, parentPatch);

  parent.emit("session_shutdown", {}, ctx);
  assert.equal(AssistantMessageComponent.prototype.updateContent, original);
});

test("thinking headings are static and contain no elapsed time", async () => {
  const { pi, emit } = runtime();
  const ctx = tuiContext();
  installCompactThinking(pi, {
    useSummaryTitlesAsThinkingTitle: false,
    previewLines: 3,
  });
  emit("session_start", {}, ctx);

  try {
    const message = thinkingMessage(Date.now());
    const component = new AssistantMessageComponent(message, true);
    component.updateContent(message);
    emit("message_update", {
      message,
      assistantMessageEvent: { type: "thinking_start", contentIndex: 0 },
    });

    const active = renderText(component);
    assert.ok(active.some((line) => line.includes("Thinking")));
    assert.ok(active.every((line) => !/\d+(?:ms|s|m)/.test(line)));

    await new Promise((resolve) => setTimeout(resolve, 300));
    assert.deepEqual(renderText(component), active, "no animation frame changes the heading");

    emit("message_update", {
      message,
      assistantMessageEvent: { type: "text_start", contentIndex: 1 },
    });
    const completed = renderText(component);
    assert.ok(completed.some((line) => line.startsWith("Thought")));
    assert.ok(completed.every((line) => !/Thought for|\d+(?:ms|s|m)/.test(line)));
  } finally {
    emit("session_shutdown", {}, ctx);
  }
});

test("Agent tool execution keeps a static thinking state until the tool ends", () => {
  const { pi, emit } = runtime();
  const ctx = tuiContext();
  installCompactThinking(pi, {
    useSummaryTitlesAsThinkingTitle: false,
    previewLines: 3,
  });
  emit("session_start", {}, ctx);

  try {
    const message = thinkingMessage(Date.now(), "Agent");
    const component = new AssistantMessageComponent(message, true);
    component.updateContent(message);
    emit("message_update", {
      message,
      assistantMessageEvent: { type: "thinking_start", contentIndex: 0 },
    });
    emit("message_update", {
      message,
      assistantMessageEvent: { type: "toolcall_start", contentIndex: 1 },
    });
    emit("message_end", { message }, ctx);
    assert.ok(renderText(component).some((line) => line.includes("Thinking")));

    emit("tool_execution_end", { toolName: "Agent", toolCallId: "tool-1" }, ctx);
    assert.ok(renderText(component).some((line) => line.startsWith("Thought")));
  } finally {
    emit("session_shutdown", {}, ctx);
  }
});

test("thinking preview remains bounded and expansion state survives content rebuilds", () => {
  const { pi, emit } = runtime();
  const ctx = tuiContext();
  installCompactThinking(pi, {
    useSummaryTitlesAsThinkingTitle: false,
    previewLines: 3,
  });
  emit("session_start", {}, ctx);

  try {
    const body = Array.from({ length: 20 }, (_, index) => `line-${index}`).join("\n");
    const message = {
      role: "assistant",
      timestamp: Date.now(),
      content: [{ type: "thinking", thinking: body }],
    } as unknown as AssistantMessage;
    const component = new AssistantMessageComponent(message, true) as any;
    component.updateContent(message);

    const collapsed = renderText(component);
    assert.equal(collapsed.filter((line) => /^line-\d+$/.test(line)).length, 3);
    assert.ok(collapsed.some((line) => /more lines/.test(line)));

    const block = component.contentContainer.children.find(
      (child: unknown) => child instanceof ThinkingPreviewBlock,
    ) as ThinkingPreviewBlock;
    assert.ok(block);
    block.setExpanded(true);
    assert.ok(renderText(component).some((line) => line === "line-0"));
    assert.ok(renderText(component).some((line) => line === "line-19"));

    component.updateContent(message);
    const rebuilt = component.contentContainer.children.find(
      (child: unknown) => child instanceof ThinkingPreviewBlock,
    ) as ThinkingPreviewBlock;
    assert.equal(rebuilt.expanded, true);
  } finally {
    emit("session_shutdown", {}, ctx);
    clearThinkingPreviewCache();
  }
});
