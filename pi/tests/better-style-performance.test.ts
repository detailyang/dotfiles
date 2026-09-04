import assert from "node:assert/strict";
import test from "node:test";
import type { AssistantMessage } from "@earendil-works/pi-ai";
import { AssistantMessageComponent, initTheme } from "@earendil-works/pi-coding-agent";
import { config } from "../extensions/better-style/config/config.ts";
import { installCompactThinking } from "../extensions/better-style/feature/compact-thinking.ts";
import { installCompactMode } from "../extensions/better-style/renderer/compact-mode.ts";
import { WriteExecutionMetadataStore } from "../extensions/better-style/renderer/tool/diff/write-execution.ts";

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
      appendEntry() {},
    } as any,
    emit(name: string, event: any = {}, ctx: any = {}) {
      for (const handler of handlers.get(name) ?? []) handler(event, ctx);
    },
  };
}

function thinkingMessage(timestamp: number, text: string): AssistantMessage {
  return {
    role: "assistant",
    timestamp,
    content: [{ type: "thinking", thinking: text }],
  } as unknown as AssistantMessage;
}

test("thinking activity does not rebuild or periodically render a 400-message transcript", async () => {
  const { pi, emit } = runtime();
  const mounted: AssistantMessageComponent[] = [];
  let renderRequests = 0;
  const tui = {
    getMountedRoots: () => mounted,
    requestRender() {
      renderRequests++;
    },
  };
  const ctx = {
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

  installCompactThinking(pi, {
    useSummaryTitlesAsThinkingTitle: false,
    previewLines: 3,
  });
  emit("session_start", {}, ctx);

  try {
    for (let index = 0; index < 400; index++) {
      const message = thinkingMessage(index + 1, `completed thought ${index}`);
      const component = new AssistantMessageComponent(message, true);
      component.updateContent(message);
      mounted.push(component);
    }

    const activeMessage = thinkingMessage(400, "active thought");
    const activeComponent = mounted.at(-1) as any;
    activeComponent.updateContent(activeMessage);
    const updateContent = activeComponent.updateContent.bind(activeComponent);
    let rebuilds = 0;
    activeComponent.updateContent = (...args: any[]) => {
      rebuilds++;
      return updateContent(...args);
    };

    emit("message_update", {
      message: activeMessage,
      assistantMessageEvent: { type: "thinking_start", contentIndex: 0 },
    });
    const rebuildsAfterEvent = rebuilds;
    renderRequests = 0;

    await new Promise((resolve) => setTimeout(resolve, 650));

    assert.equal(rebuilds, rebuildsAfterEvent, "timer ticks must not call updateContent");
    assert.equal(renderRequests, 0, "thinking activity must not schedule periodic renders");

    emit("message_update", {
      message: activeMessage,
      assistantMessageEvent: { type: "text_start", contentIndex: 1 },
    });
    const rendersAfterFinish = renderRequests;
    await new Promise((resolve) => setTimeout(resolve, 320));
    assert.equal(renderRequests, rendersAfterFinish, "thinking completion leaves no timer behind");
  } finally {
    emit("session_shutdown", {}, ctx);
  }
});

test("an active compact round does not start a second render interval", async () => {
  const previousMode = config.mode;
  config.mode = "compact";
  let renderRequests = 0;
  const hooks = installCompactMode({ writeMetadata: new WriteExecutionMetadataStore() });
  const ctx = {
    mode: "tui",
    hasUI: true,
    ui: {
      theme: {
        fg: (_color: string, text: string) => text,
        italic: (text: string) => text,
        bold: (text: string) => text,
      },
      requestRender() {
        renderRequests++;
      },
    },
  } as any;

  try {
    hooks.sync(ctx);
    const message = {
      role: "assistant",
      timestamp: Date.now(),
      content: [{ type: "toolCall", id: "tool-1", name: "bash", arguments: {} }],
    } as unknown as AssistantMessage;
    const component = new AssistantMessageComponent(message, true);
    component.updateContent(message);
    renderRequests = 0;

    await new Promise((resolve) => setTimeout(resolve, 600));

    assert.equal(renderRequests, 0, "compact rounds rely on event and host spinner renders");
  } finally {
    hooks.shutdown();
    config.mode = previousMode;
  }
});
