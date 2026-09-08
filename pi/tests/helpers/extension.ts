import type { ExtensionAPI, ExtensionContext, ExtensionFactory } from "@earendil-works/pi-coding-agent";

export function createExtensionHarness(factory: ExtensionFactory) {
  const handlers = new Map<string, Array<(event: any, ctx: ExtensionContext) => any>>();
  const commands = new Map<string, any>();
  const tools = new Map<string, any>();
  const entries: any[] = [];
  const sent: any[] = [];
  const notices: string[] = [];
  let branch = entries;
  const ctx: any = {
    cwd: "/offline", mode: "print", hasUI: true, model: undefined,
    isIdle: () => true, hasPendingMessages: () => false, isProjectTrusted: () => false,
    abort() {}, getSystemPrompt: () => "",
    sessionManager: { getEntries: () => entries, getBranch: () => branch, getLeafId: () => null },
    modelRegistry: { getRegisteredProviderIds: () => [], getApiKeyAndHeaders: async () => ({ ok: true }) },
    ui: { theme: { fg: (_color: string, text: string) => text, bold: (text: string) => text },
      setStatus() {}, setWidget() {}, confirm: async () => true,
      notify: (text: string) => notices.push(text) },
  };
  const pi = {
    on(name: string, handler: any) { handlers.set(name, [...(handlers.get(name) ?? []), handler]); },
    registerCommand: (name: string, command: any) => commands.set(name, command),
    registerTool: (tool: any) => tools.set(tool.name, tool),
    registerShortcut() {}, registerMessageRenderer() {}, getThinkingLevel: () => "off",
    appendEntry: (customType: string, data: unknown) => entries.push({ type: "custom", customType, data }),
    sendMessage: (message: any, options: any) => sent.push({ message, options }),
    sendUserMessage: (message: any, options: any) => sent.push({ message, options }),
  } as unknown as ExtensionAPI;
  factory(pi);
  return { pi, ctx, entries, sent, notices, tools,
    setBranch: (next: any[]) => { branch = next; },
    emit: (name: string, event: any = {}) => Promise.all((handlers.get(name) ?? []).map((handler) => handler({ type: name, ...event }, ctx))),
    command: (name: string, args = "") => commands.get(name).handler(args, ctx),
  };
}
