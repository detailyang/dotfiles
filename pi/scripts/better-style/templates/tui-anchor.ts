const WIDGET_KEY = "better-style-tui-anchor";
let activeTui: any;
let activeUi: any;
let renderTimer: ReturnType<typeof setTimeout> | undefined;

const EMPTY_WIDGET = {
  render(): string[] {
    return [];
  },
  invalidate() {},
};

export function getBetterStyleTui(): any {
  return activeTui;
}

export function installTuiAnchor(ctx: any): void {
  if (ctx?.mode !== "tui" || !ctx?.hasUI || typeof ctx.ui?.setWidget !== "function") return;
  activeUi = ctx.ui;
  ctx.ui.setWidget(WIDGET_KEY, (tui: any) => {
    activeTui = tui;
    return EMPTY_WIDGET;
  });
}

export function scheduleSessionRender(refresh?: () => void): void {
  if (renderTimer) clearTimeout(renderTimer);
  const tick = (attempt: number) => {
    renderTimer = undefined;
    const tui = activeTui;
    if (!tui && attempt < 4) {
      renderTimer = setTimeout(() => tick(attempt + 1), 16);
      renderTimer.unref?.();
      return;
    }
    refresh?.();
    tui?.requestRender?.(true);
  };
  renderTimer = setTimeout(() => tick(0), 0);
  renderTimer.unref?.();
}

export function teardownTuiAnchor(): void {
  if (renderTimer) clearTimeout(renderTimer);
  renderTimer = undefined;
  try {
    activeUi?.setWidget?.(WIDGET_KEY, undefined);
  } catch {
    // The UI can already be disposed during reload or shutdown.
  }
  activeUi = undefined;
  activeTui = undefined;
}
