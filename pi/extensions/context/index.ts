import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { type GraphView, GRAPH_VIEWS, graphViewLabel, renderGraphBody } from "./graph-view.js";
import { ScrollDialog } from "./scroll-dialog.js";
import { collectCacheSessionMetrics } from "./session-data.js";

export default function contextExtension(pi: ExtensionAPI): void {
  pi.registerCommand("context", {
    description: "Show context cache hit graph for the current session",
    getArgumentCompletions(prefix) {
      const items = [
        { value: "graph", label: "graph", description: "Show cache hit % graph over time" },
      ];
      const filtered = items.filter((item) => item.value.startsWith(prefix.toLowerCase()));
      return filtered.length > 0 ? filtered : items;
    },
    handler: async (_args, ctx) => {
      if (!ctx.hasUI) {
        ctx.ui.notify("/context requires interactive TUI mode.", "info");
        return;
      }

      let metrics = collectCacheSessionMetrics(ctx.sessionManager);
      let currentView: GraphView = "per-turn";

      await ctx.ui.custom<void>(
        (_tui, theme, _keybindings, done) =>
          new ScrollDialog(
            theme,
            {
              title: "Context Cache Graph",
              getTitle: () => `Context Cache Graph — ${graphViewLabel(currentView)}`,
              helpText: "1/2/3 view • r refresh • v cycle • ↑/↓ scroll • PgUp/PgDn • q/Esc close",
              renderBody: (innerWidth) => renderGraphBody(theme, metrics, innerWidth, currentView),
              onKey: (data) => {
                if (data === "r") {
                  metrics = collectCacheSessionMetrics(ctx.sessionManager);
                  return true;
                }
                const prev = currentView;
                if (data === "1") currentView = "per-turn";
                else if (data === "2") currentView = "cumulative-percent";
                else if (data === "3") currentView = "cumulative-total";
                else if (data === "v") {
                  const idx = GRAPH_VIEWS.indexOf(currentView);
                  currentView = GRAPH_VIEWS[(idx + 1) % GRAPH_VIEWS.length]!;
                } else if (data === "V") {
                  const idx = GRAPH_VIEWS.indexOf(currentView);
                  currentView = GRAPH_VIEWS[(idx + GRAPH_VIEWS.length - 1) % GRAPH_VIEWS.length]!;
                } else {
                  return false;
                }
                return currentView !== prev || true; // always re-render on a recognised key
              },
            },
            () => done(undefined),
          ),
        {
          overlay: true,
          overlayOptions: {
            anchor: "center",
            width: "90%",
            maxHeight: "90%",
            margin: 1,
          },
        },
      );
    },
  });
}
